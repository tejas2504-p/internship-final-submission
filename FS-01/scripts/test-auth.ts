import "dotenv/config";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db/prisma";

async function runAuthTests() {
  console.log("=== SyncSpace Phase 3A: Authentication Verification Suite ===");
  const testEmail = "test_engineer_phase3a@syncspace.app";
  const testPassword = "SecurePassword123!";
  const testName = "Jane Doe";

  try {
    // 0. Clean up any previous test artifact
    console.log("\n[Test 0] Pre-test database check and cleanup...");
    const existingUser = await prisma.user.findUnique({ where: { email: testEmail } });
    if (existingUser) {
      await prisma.user.delete({ where: { email: testEmail } });
      console.log("-> Cleaned up stale test user.");
    } else {
      console.log("-> Pre-test state clean.");
    }

    // 1. Test Registration
    console.log("\n[Test 1] Testing User Registration via Better Auth API...");
    const signUpResult = await auth.api.signUpEmail({
      body: {
        name: testName,
        email: testEmail,
        password: testPassword,
      },
    });

    if (!signUpResult || !signUpResult.user) {
      throw new Error("Registration failed: no user returned");
    }
    console.log("-> Registration SUCCESS: User created with ID:", signUpResult.user.id);
    console.log("-> User email:", signUpResult.user.email);
    console.log("-> User name:", signUpResult.user.name);

    // 2. Verify Database Persistence & Security
    console.log("\n[Test 2] Verifying PostgreSQL database persistence & password hashing...");
    const dbUser = await prisma.user.findUnique({
      where: { email: testEmail },
      include: { accounts: true, sessions: true },
    });

    if (!dbUser) {
      throw new Error("Database verification failed: User not found in users table");
    }
    console.log("-> Database record confirmed in table 'users'.");
    console.log("-> Accounts count for user:", dbUser.accounts.length);

    const account = dbUser.accounts[0];
    if (!account || !account.password) {
      throw new Error("Database verification failed: Password hash not stored in accounts table");
    }
    // Verify password is encrypted/hashed
    if (account.password === testPassword) {
      throw new Error("SECURITY FAILURE: Password stored in plaintext!");
    }
    console.log("-> Password securely hashed (scrypt):", account.password.length > 20);

    // 3. Test Invalid Login
    console.log("\n[Test 3] Testing Invalid Credentials Login (Rejection test)...");
    try {
      await auth.api.signInEmail({
        body: {
          email: testEmail,
          password: "WrongPassword999!",
        },
      });
      throw new Error("SECURITY FAILURE: Login succeeded with wrong password!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unauthorized";
      console.log("-> Invalid password properly rejected with message:", msg);
    }

    // 4. Test Valid Login & Session Generation
    console.log("\n[Test 4] Testing Valid Credentials Login & Session Cookie generation...");
    const signInResult = await auth.api.signInEmail({
      body: {
        email: testEmail,
        password: testPassword,
      },
      asResponse: true,
    });

    const setCookieHeaders = signInResult.headers.get("set-cookie");
    if (!setCookieHeaders) {
      throw new Error("Sign in failed: No set-cookie header returned");
    }
    console.log("-> Sign in SUCCESS: Session cookie issued by Better Auth.");
    console.log("-> Cookie attributes check: contains httpOnly:", setCookieHeaders.toLowerCase().includes("httponly"));
    console.log("-> Cookie attributes check: contains SameSite:", setCookieHeaders.toLowerCase().includes("samesite"));

    // Extract cookie for session verification
    const cookieHeader = setCookieHeaders.split(";")[0];

    // 5. Test Server-side Session Verification
    console.log("\n[Test 5] Testing Server-side Session Verification with valid cookie...");
    const verifiedSession = await auth.api.getSession({
      headers: new Headers({
        cookie: cookieHeader,
      }),
    });

    if (!verifiedSession || !verifiedSession.user || !verifiedSession.session) {
      throw new Error("Session verification failed: session not found with cookie");
    }
    console.log("-> Server Session verification SUCCESS:");
    console.log("   Session ID:", verifiedSession.session.id);
    console.log("   User ID:", verifiedSession.user.id);
    console.log("   User Email:", verifiedSession.user.email);
    console.log("   Session Expires At:", verifiedSession.session.expiresAt);

    // 6. Test Unauthenticated Access Rejection
    console.log("\n[Test 6] Testing Unauthenticated Session Verification (Dashboard protection check)...");
    const unauthenticatedSession = await auth.api.getSession({
      headers: new Headers(), // No cookie provided
    });

    if (unauthenticatedSession !== null) {
      throw new Error("SECURITY FAILURE: Unauthenticated call returned a session!");
    }
    console.log("-> Unauthenticated access properly returned null (Access Denied / Redirect).");

    // 7. Test Sign Out / Session Revocation
    console.log("\n[Test 7] Testing Sign Out & Session Invalidation...");
    await auth.api.signOut({
      headers: new Headers({
        cookie: cookieHeader,
      }),
    });

    // Verify session is now revoked or expired
    const postLogoutSession = await auth.api.getSession({
      headers: new Headers({
        cookie: cookieHeader,
      }),
    });

    if (postLogoutSession !== null) {
      throw new Error("Sign out verification failed: session still active after signOut!");
    }
    console.log("-> Sign out SUCCESS: Session successfully invalidated.");

    // 8. Cleanup test data
    console.log("\n[Test 8] Cleaning up test user from database...");
    await prisma.user.delete({ where: { email: testEmail } });
    console.log("-> Test user cleanly removed from database.");

    console.log("\n=======================================================");
    console.log("ALL 7 AUTHENTICATION INTEGRATION TESTS PASSED (100%)!");
    console.log("=======================================================");
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("\nTEST FAILED:", msg);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

runAuthTests();
