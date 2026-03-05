import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const carrierId = searchParams.get("carrierId");
    const category = searchParams.get("category");
    const year = searchParams.get("year");

    if (!carrierId) {
      return NextResponse.json(
        { error: "carrierId is required" },
        { status: 400 }
      );
    }

    const where: Record<string, unknown> = { carrierId };
    if (category) where.category = category;
    if (year) where.year = parseInt(year, 10);

    const commentaries = await prisma.commentary.findMany({
      where,
      orderBy: [
        { year: "desc" },
        { quarter: "desc" },
        { sourceDate: "desc" },
      ],
    });

    return NextResponse.json(commentaries);
  } catch (error) {
    console.error("Error fetching commentary:", error);
    return NextResponse.json(
      { error: "Failed to fetch commentary" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      carrierId,
      source,
      category,
      quarter,
      year,
      title,
      content,
      sentiment,
      sourceDate,
      sourceUrl,
    } = body;

    if (
      !carrierId ||
      !source ||
      !category ||
      !quarter ||
      !year ||
      !title ||
      !content ||
      !sentiment ||
      !sourceDate
    ) {
      return NextResponse.json(
        { error: "Missing required fields: carrierId, source, category, quarter, year, title, content, sentiment, and sourceDate are all required" },
        { status: 400 }
      );
    }

    const commentary = await prisma.commentary.create({
      data: {
        carrierId,
        source,
        category,
        quarter: parseInt(quarter, 10),
        year: parseInt(year, 10),
        title,
        content,
        sentiment,
        sourceDate: new Date(sourceDate),
        sourceUrl: sourceUrl || null,
      },
    });

    return NextResponse.json(commentary, { status: 201 });
  } catch (error) {
    console.error("Error creating commentary:", error);

    // Handle unique constraint violation
    if (
      error instanceof Error &&
      error.message.includes("Unique constraint")
    ) {
      return NextResponse.json(
        { error: "A commentary entry with this title and date already exists for this carrier" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create commentary" },
      { status: 500 }
    );
  }
}
