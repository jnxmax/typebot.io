import { env } from "@typebot.io/env";
import { proWorkspaceId } from "@typebot.io/playwright/databaseSetup";
import prisma from "@typebot.io/prisma";
import type { CollaborationType } from "@typebot.io/prisma/enum";
import type { Prisma } from "@typebot.io/prisma/types";
import type { Workspace } from "@typebot.io/workspaces/schemas";
import Stripe from "stripe";

const stripe = new Stripe(env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2024-09-30.acacia",
});

export const addSubscriptionToWorkspace = async (
  workspaceId: string,
  items: Stripe.SubscriptionCreateParams.Item[],
  metadata: Pick<Workspace, "plan">,
) => {
  const { id: stripeId } = await stripe.customers.create({
    email: "test-user@gmail.com",
    name: "Test User",
  });
  const { id: paymentId } = await stripe.paymentMethods.create({
    card: {
      number: "4242424242424242",
      exp_month: 12,
      exp_year: 2034,
      cvc: "123",
    },
    type: "card",
  });
  await stripe.paymentMethods.attach(paymentId, { customer: stripeId });
  await stripe.subscriptions.create({
    customer: stripeId,
    items,
    default_payment_method: paymentId,
    currency: "usd",
  });
  await stripe.customers.update(stripeId, {
    invoice_settings: { default_payment_method: paymentId },
  });
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      stripeId,
      ...metadata,
    },
  });
  return stripeId;
};

export const cancelSubscription = async (stripeId: string) => {
  const currentSubscriptionId = (
    await stripe.subscriptions.list({
      customer: stripeId,
      limit: 1,
      status: "active",
    })
  ).data.shift()?.id;
  if (currentSubscriptionId)
    await stripe.subscriptions.update(currentSubscriptionId, {
      cancel_at_period_end: true,
    });
};

export const createCollaboration = (
  userId: string,
  typebotId: string,
  type: CollaborationType,
) =>
  prisma.collaboratorsOnTypebots.create({ data: { userId, typebotId, type } });

export const getSignedInUser = (email: string) =>
  prisma.user.findFirst({ where: { email } });

export const createFolders = (
  partialFolders: Partial<Prisma.DashboardFolder>[],
) =>
  prisma.dashboardFolder.createMany({
    data: partialFolders.map((folder) => ({
      workspaceId: proWorkspaceId,
      name: "Folder #1",
      ...folder,
    })),
  });

export const createFolder = (workspaceId: string, name: string) =>
  prisma.dashboardFolder.create({
    data: {
      workspaceId,
      name,
    },
  });

export const createClaimableCustomPlan = async (
  data: Prisma.Prisma.ClaimableCustomPlanUncheckedCreateInput,
) =>
  prisma.claimableCustomPlan.create({
    data,
  });
