!include "LogicLib.nsh"

Var nomixFinalDirectory
Var nomixNewDirectory
Var nomixOldDirectory
Var nomixOldMoved
Var nomixNewMoved
Var nomixDirectoryError
Var nomixDirectorySource
Var nomixDirectoryDestination
Var nomixRestoreError
Var nomixDirectoryLogDirectory
Var nomixRecoveryStopped

; MoveFileEx preserves the destination and exposes the Windows error before rollback changes it.
; Open files inside a directory can make its rename return access denied (5).
!macro nomixDirectoryOperation SOURCE DESTINATION RESULT PHASE
  Push $0
  Push $1
  Push $2
  StrCpy $0 0
  ${Do}
    ${If} "${DESTINATION}" == ""
      System::Call 'kernel32::RemoveDirectoryW(w "${SOURCE}") i.r1 ?e'
    ${Else}
      System::Call 'kernel32::MoveFileExW(w "${SOURCE}", w "${DESTINATION}", i 0) i.r1 ?e'
    ${EndIf}
    Pop ${RESULT}
    ${If} "${DESTINATION}" == ""
      ${If} ${RESULT} == 2
      ${OrIf} ${RESULT} == 3
        StrCpy $1 1
      ${EndIf}
    ${EndIf}
    ${If} $1 != 0
      StrCpy ${RESULT} 0
      ${ExitDo}
    ${EndIf}
    ClearErrors
    FileOpen $2 "$PLUGINSDIR\directory-operations.log" a
    ${IfNot} ${Errors}
      FileSeek $2 0 END
      FileWrite $2 "${PHASE}: Windows error: ${RESULT}$\r$\n"
      FileClose $2
    ${EndIf}
    ${If} ${RESULT} != 5
    ${AndIf} ${RESULT} != 32
    ${AndIf} ${RESULT} != 33
      ${ExitDo}
    ${EndIf}
    IntOp $0 $0 + 1
    ${If} $0 >= 10
      ${ExitDo}
    ${EndIf}
    IntOp $1 $0 * 250
    Sleep $1
  ${Loop}
  Pop $2
  Pop $1
  Pop $0
!macroend

!macro nomixReportDirectoryFailure
  ${If} $nomixRestoreError != 0
    StrCpy $nomixRecoveryStopped "1"
  ${EndIf}
  !ifmacrodef customInstallerDirectoryFailed
    !insertmacro customInstallerDirectoryFailed
  !else
    DetailPrint "Directory operation failed ($nomixDirectoryError): $nomixDirectorySource -> $nomixDirectoryDestination; restore error: $nomixRestoreError"
  !endif
!macroend

!macro nomixExtractPayload FILE
  !ifmacrodef customInstallerExtract
    !insertmacro customInstallerExtract "${FILE}"
  !else
    nsExec::ExecToStack '"$PLUGINSDIR\nomix-7za.exe" x -y -bd -bb0 "-o$INSTDIR" "${FILE}"'
    Pop $R0
    Pop $R1
  !endif
  ${If} $R0 != 0
    DetailPrint $R1
    Call nomixRollbackDirectories
    !ifmacrodef customInstallerExtractFailed
      !insertmacro customInstallerExtractFailed "${FILE}"
    !else
      MessageBox MB_OK|MB_ICONEXCLAMATION "$(decompressionFailed)" /SD IDOK
    !endif
    SetErrorLevel 2
    Quit
  ${EndIf}
!macroend

!macro nomixStageApplication
  !ifdef NOMIX_INSTALLER_LOG_DIR
    ; electron-builder defines the cache name after including our function bodies, before this section expands.
    StrCpy $nomixDirectoryLogDirectory "${NOMIX_INSTALLER_LOG_DIR}"
  !endif
  StrCpy $nomixFinalDirectory $INSTDIR
  System::Call 'ole32::CoCreateGuid(g .r0) i .r1'
  ${If} $1 != 0
    SetErrorLevel 2
    Quit
  ${EndIf}
  StrCpy $nomixNewDirectory "$INSTDIR.new-$0"
  StrCpy $nomixOldDirectory "$INSTDIR.old-$0"
  StrCpy $nomixOldMoved ""
  StrCpy $nomixNewMoved ""
  StrCpy $nomixDirectoryError 0
  StrCpy $nomixRestoreError 0
  StrCpy $nomixRecoveryStopped ""
  ClearErrors
  CreateDirectory $nomixNewDirectory
  ${If} ${Errors}
    SetErrorLevel 2
    Quit
  ${EndIf}
  File /oname=$PLUGINSDIR\nomix-7za.exe "${NOMIX_SEVENZIP_PATH}"
  StrCpy $INSTDIR $nomixNewDirectory
  SetOutPath $INSTDIR
  !insertmacro installApplicationFiles
  !ifdef NOMIX_SEVENZIP_LICENSE_DIR
    File /oname=7zip-installer-LICENSE.txt "${NOMIX_SEVENZIP_LICENSE_DIR}\LICENSE.txt"
    File /oname=7zip-installer-COPYING.txt "${NOMIX_SEVENZIP_LICENSE_DIR}\COPYING"
  !endif
  !ifdef UNINSTALLER_ICON
    File /oname=uninstallerIcon.ico "${UNINSTALLER_ICON}"
  !endif
  StrCpy $INSTDIR $nomixFinalDirectory
  SetOutPath $PLUGINSDIR
!macroend

Function .onGUIEnd
  Call nomixCleanupDirectories
FunctionEnd

Function nomixCleanupDirectories
  ${If} $nomixRecoveryStopped == "1"
    Return
  ${EndIf}
  ${If} $nomixFinalDirectory != ""
    Call nomixRollbackDirectories
  ${EndIf}
FunctionEnd

; Only directories created or renamed by this installer are removed during rollback.
Function nomixRollbackDirectories
  SetOutPath $PLUGINSDIR
  ${If} $nomixNewMoved == "1"
    RMDir /r "\\?\$nomixFinalDirectory"
    StrCpy $nomixNewMoved ""
  ${EndIf}
  ${If} $nomixOldMoved == "1"
    !insertmacro nomixDirectoryOperation "$nomixOldDirectory" "$nomixFinalDirectory" $nomixRestoreError "restore"
    ${If} $nomixRestoreError != 0
      ; Leave the complete backup in place if another process prevents restoration.
      DetailPrint $nomixOldDirectory
      RMDir /r "\\?\$nomixNewDirectory"
      Return
    ${EndIf}
    StrCpy $nomixOldMoved ""
  ${EndIf}
  ${If} $nomixNewDirectory != ""
    RMDir /r "\\?\$nomixNewDirectory"
  ${EndIf}
  StrCpy $INSTDIR $nomixFinalDirectory
FunctionEnd

Function nomixPromoteDirectories
  !ifmacrodef InstallerPublishStage
    !insertmacro InstallerPublishStage 2
  !endif
  ; SetOutPath opens a directory handle; release it before either rename.
  SetOutPath $PLUGINSDIR
  ClearErrors
  ${If} ${FileExists} "$nomixFinalDirectory\*.*"
    StrCpy $nomixDirectorySource $nomixFinalDirectory
    StrCpy $nomixDirectoryDestination $nomixOldDirectory
    !insertmacro nomixDirectoryOperation "$nomixDirectorySource" "$nomixDirectoryDestination" $nomixDirectoryError "backup"
    ${If} $nomixDirectoryError != 0
      Call nomixRollbackDirectories
      !insertmacro nomixReportDirectoryFailure
      SetErrors
      Return
    ${EndIf}
    StrCpy $nomixOldMoved "1"
  ${Else}
    ; NSIS can create the destination before the install section starts.
    StrCpy $nomixDirectorySource $nomixFinalDirectory
    StrCpy $nomixDirectoryDestination ""
    !insertmacro nomixDirectoryOperation "$nomixDirectorySource" "" $nomixDirectoryError "remove-empty"
    ${If} $nomixDirectoryError != 0
      Call nomixRollbackDirectories
      !insertmacro nomixReportDirectoryFailure
      SetErrors
      Return
    ${EndIf}
  ${EndIf}
  ClearErrors
  StrCpy $nomixDirectorySource $nomixNewDirectory
  StrCpy $nomixDirectoryDestination $nomixFinalDirectory
  !insertmacro nomixDirectoryOperation "$nomixDirectorySource" "$nomixDirectoryDestination" $nomixDirectoryError "promote"
  ${If} $nomixDirectoryError != 0
    Call nomixRollbackDirectories
    !insertmacro nomixReportDirectoryFailure
    SetErrors
    Return
  ${EndIf}
  StrCpy $nomixNewMoved "1"
  SetOutPath $nomixFinalDirectory
  !ifmacrodef InstallerPublishStage
    !insertmacro InstallerPublishStage 3
  !endif
  ClearErrors
FunctionEnd

!macro nomixFinishDirectories
  StrCpy $nomixNewMoved ""
  ${If} $nomixOldMoved == "1"
    RMDir /r "\\?\$nomixOldDirectory"
    StrCpy $nomixOldMoved ""
  ${EndIf}
!macroend
