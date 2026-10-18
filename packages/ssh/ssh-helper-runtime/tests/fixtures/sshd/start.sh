#!/bin/sh
set -eu
ssh-keygen -q -t ed25519 -N '' -f /etc/ssh/ssh_host_ed25519_key
install -d -m 700 -o nomix -g nomix /home/nomix/.ssh
install -m 600 -o nomix -g nomix /fixture-key.pub /home/nomix/.ssh/authorized_keys
install -d -m 700 -o nomix -g nomix /home/nomix/workspace
exec /usr/sbin/sshd -D -e -f /etc/ssh/sshd_config
