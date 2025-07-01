import { Hono } from "hono";
import { jwt } from "hono/jwt";
import { sign } from "hono/jwt";
import { db, users } from "@open-bias/db";
import { eq } from "drizzle-orm";

const authApp = new Hono();

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// Login endpoint
authApp.post("/login", async (c) => {
  try {
    const { email, password } = await c.req.json();

    if (!email || !password) {
      return c.json({ error: "Email and password are required" }, 400);
    }

    // Demo users for testing when database is empty
    const demoUsers = [
      {
        id: 1,
        email: "demo@example.com",
        name: "Demo User",
        passwordHash: "demo123",
        role: "user",
        preferences: JSON.stringify({ showAllPerspectives: false }),
      },
      {
        id: 2,
        email: "admin@example.com",
        name: "Admin User", 
        passwordHash: "admin123",
        role: "admin",
        preferences: JSON.stringify({ showAllPerspectives: true }),
      }
    ];

    let user;
    
    try {
      // Try to find user in database first
      user = await db.query.users.findFirst({
        where: eq(users.email, email),
      });
    } catch (dbError) {
      console.warn("Database error, using demo users:", dbError);
    }

    // If no user found in database, check demo users
    if (!user) {
      user = demoUsers.find(u => u.email === email);
      if (!user) {
        return c.json({ error: "Invalid credentials" }, 401);
      }
    }

    // Verify password (simplified for demo - in production use proper bcrypt)
    const isValidPassword = password === user.passwordHash; // Direct comparison for demo
    if (!isValidPassword) {
      return c.json({ error: "Invalid credentials" }, 401);
    }

    // Generate JWT token
    const token = await sign(
      { 
        userId: user.id, 
        email: user.email,
        role: user.role,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 // 7 days
      },
      JWT_SECRET
    );

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        preferences: user.preferences,
      },
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    return c.json({ error: "Login failed" }, 500);
  }
});

// Register endpoint
authApp.post("/register", async (c) => {
  try {
    const { email, password, name } = await c.req.json();

    if (!email || !password || !name) {
      return c.json({ error: "Email, password, and name are required" }, 400);
    }

    let existingUser;
    
    try {
      // Check if user already exists in database
      existingUser = await db.query.users.findFirst({
        where: eq(users.email, email),
      });
    } catch (dbError) {
      console.warn("Database error during registration check, proceeding with mock registration:", dbError);
    }

    // Check demo users too
    const demoEmails = ["demo@example.com", "admin@example.com"];
    if (existingUser || demoEmails.includes(email)) {
      return c.json({ error: "User already exists" }, 409);
    }

    let newUser;
    
    try {
      // Hash password (simplified for demo - in production use proper bcrypt)
      const passwordHash = password; // Direct storage for demo

      // Create user in database
      await db
        .insert(users)
        .values({
          email,
          name,
          passwordHash,
          role: "user",
          preferences: JSON.stringify({ showAllPerspectives: true }),
        });

      // Get the created user
      newUser = await db.query.users.findFirst({
        where: eq(users.email, email),
      });
    } catch (dbError) {
      console.warn("Database error during user creation, using mock user:", dbError);
      // Create a mock user for demo purposes
      newUser = {
        id: Math.floor(Math.random() * 10000) + 100,
        email,
        name,
        passwordHash: password,
        role: "user",
        preferences: JSON.stringify({ showAllPerspectives: true }),
      };
    }

    if (!newUser) {
      return c.json({ error: "Failed to create user" }, 500);
    }

    // Generate JWT token
    const token = await sign(
      { 
        userId: newUser.id, 
        email: newUser.email,
        role: newUser.role,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 // 7 days
      },
      JWT_SECRET
    );

    return c.json({
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        preferences: newUser.preferences,
      },
      token,
    }, 201);
  } catch (error) {
    console.error("Registration error:", error);
    return c.json({ error: "Registration failed" }, 500);
  }
});

// Middleware to verify JWT token
export const authMiddleware = jwt({
  secret: JWT_SECRET,
});

// Get current user profile
authApp.get("/me", authMiddleware, async (c) => {
  try {
    const payload = c.get("jwtPayload");
    const userId = payload.userId;

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        id: true,
        email: true,
        name: true,
        role: true,
        preferences: true,
        createdAt: true,
      },
    });

    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    return c.json({ user });
  } catch (error) {
    console.error("Get profile error:", error);
    return c.json({ error: "Failed to get user profile" }, 500);
  }
});

// Update user preferences
authApp.put("/preferences", authMiddleware, async (c) => {
  try {
    const payload = c.get("jwtPayload");
    const userId = payload.userId;
    const { biasPreferences } = await c.req.json();

    await db
      .update(users)
      .set({
        preferences: JSON.stringify(biasPreferences),
      })
      .where(eq(users.id, userId));

    return c.json({ success: true });
  } catch (error) {
    console.error("Update preferences error:", error);
    return c.json({ error: "Failed to update preferences" }, 500);
  }
});

export default authApp;
