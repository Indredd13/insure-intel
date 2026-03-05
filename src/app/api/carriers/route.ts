import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";
    const companyType = searchParams.get("companyType") || "";
    const publicOnly = searchParams.get("publicOnly") === "true";

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { ticker: { contains: search } },
        { description: { contains: search } },
      ];
    }

    if (category) {
      where.category = category;
    }

    if (companyType) {
      where.companyType = companyType;
    }

    if (publicOnly) {
      where.isPubliclyTraded = true;
    }

    const carriers = await prisma.carrier.findMany({
      where,
      orderBy: { name: "asc" },
    });

    return NextResponse.json(carriers);
  } catch (error) {
    console.error("Error fetching carriers:", error);
    return NextResponse.json(
      { error: "Failed to fetch carriers" },
      { status: 500 }
    );
  }
}
