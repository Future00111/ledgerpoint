/**
 * /api/me — returns the current authenticated user info from Clerk session.
 * Replaces base44.auth.me()
 */
import { Router, type Request, type Response } from "express";
import { getAuth, clerkClient } from "@clerk/express";

const router = Router();

router.get("/me", async (req: Request, res: Response) => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const user = await clerkClient.users.getUser(userId);
    res.json({
      id: user.id,
      email: user.emailAddresses?.[0]?.emailAddress ?? null,
      full_name:
        [user.firstName, user.lastName].filter(Boolean).join(" ") || null,
      first_name: user.firstName ?? null,
      last_name: user.lastName ?? null,
      image_url: user.imageUrl ?? null,
    });
  } catch (err: unknown) {
    req.log.error({ err }, "me error");
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

export default router;
