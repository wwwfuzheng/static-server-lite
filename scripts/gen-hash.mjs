#!/usr/bin/env node
import bcrypt from 'bcryptjs';

const password = process.argv[2];
if (!password) {
  console.error('Usage: pnpm gen:hash <password>');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);
console.log(hash);
