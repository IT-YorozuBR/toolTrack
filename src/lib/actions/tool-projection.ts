"use server";
import { prisma } from "@/lib/prisma";
import { getToolProjection, type ToolProjection } from "@/lib/calculations/strokes";

export async function fetchToolProjection(toolId: string): Promise<ToolProjection | null> {
  const tool = await prisma.tool.findUnique({
    where: { id: toolId },
    include: {
      bomItems: {
        include: {
          product: {
            include: {
              forecasts: true,
              projectProducts: {
                include: {
                  project: { include: { forecasts: true } },
                },
              },
            },
          },
        },
      },
      maintenanceRecords: {
        where: { resetCounter: true },
        orderBy: { maintenanceDate: "desc" },
        take: 1,
      },
      monthlySnapshots: {
        orderBy: { referenceMonth: "asc" },
      },
    },
  });

  if (!tool) return null;
  return getToolProjection(tool);
}
