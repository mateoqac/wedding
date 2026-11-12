/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    user: import("@/auth/auth-service").SessionUser | null;
  }
}
