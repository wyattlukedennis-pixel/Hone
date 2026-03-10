import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hashPassword(plainTextPassword: string) {
  return bcrypt.hash(plainTextPassword, SALT_ROUNDS);
}

export async function verifyPassword(plainTextPassword: string, hashedPassword: string) {
  return bcrypt.compare(plainTextPassword, hashedPassword);
}
