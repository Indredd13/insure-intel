import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const carrier = await prisma.carrier.findUnique({
      where: { id },
    });

    if (!carrier) {
      return NextResponse.json(
        { error: "Carrier not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(carrier);
  } catch (error) {
    console.error("Error fetching carrier:", error);
    return NextResponse.json(
      { error: "Failed to fetch carrier" },
      { status: 500 }
    );
  }
}
