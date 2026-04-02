import { Router, type IRouter } from "express";
import healthRouter from "./health";
import contactsRouter from "./contacts";
import companiesRouter from "./companies";
import dealsRouter from "./deals";
import activitiesRouter from "./activities";
import dashboardRouter from "./dashboard";
import aiParseRouter from "./ai-parse";
import aiQuoteRouter from "./ai-quote";
import generatePdfRouter from "./generate-pdf";
import suiviRouter from "./suivi";
import clientPersoRouter from "./client-perso";
import webhookForminatorRouter from "./webhook-forminator";

const router: IRouter = Router();

router.use(healthRouter);
router.use(contactsRouter);
router.use(companiesRouter);
router.use(dealsRouter);
router.use(activitiesRouter);
router.use(dashboardRouter);
router.use(aiParseRouter);
router.use(aiQuoteRouter);
router.use(generatePdfRouter);
router.use(suiviRouter);
router.use(clientPersoRouter);
router.use(webhookForminatorRouter);

export default router;
