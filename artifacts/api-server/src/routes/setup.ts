import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase";

const router: IRouter = Router();

router.post("/setup/tables", async (_req, res): Promise<void> => {
  res.json({ message: "Use Supabase dashboard to create tables, or check logs for SQL." });
});

export default router;
