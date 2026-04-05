export enum UserRole {
  USER = "user",
  ADMIN = "admin",
}

export const ROLES = {
  USER: UserRole.USER,
  ADMIN: UserRole.ADMIN,
} as const;

