import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { carriers } from "@/lib/seed-data";

export async function POST() {
  try {
    // Clear existing data
    await prisma.carrier.deleteMany();

    // Insert all carriers
    let count = 0;
    for (const carrier of carriers) {
      await prisma.carrier.create({ data: carrier });
      count++;
    }

    const withCik = carriers.filter((c) => c.cikNumber).length;

    return NextResponse.json({
      message: `Successfully seeded ${count} carriers (${withCik} with CIK numbers)`,
      count,
      withCik,
    });
  } catch (error) {
    console.error("Error seeding database:", error);
    return NextResponse.json(
      { error: "Failed to seed database" },
      { status: 500 }
    );
  }
}
