// ============================================================
// GET  /api/seeking-alpha — Returns the current SA symbol list
// POST /api/seeking-alpha — Add symbols to the list
// DELETE /api/seeking-alpha — Remove a symbol from the list
// PUT  /api/seeking-alpha — Replace the entire list
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import {
  loadSAList,
  addToSAList,
  removeFromSAList,
  saveSAList,
} from "@/lib/seeking-alpha-store";
import { requirePremium } from "@/lib/auth-middleware";

/**
 * GET: Return the current Seeking Alpha symbol list.
 */
export async function GET(request: NextRequest) {
  const authResult = await requirePremium(request);
  if (!authResult.success) return authResult.response;

  try {
    const list = await loadSAList();
    return NextResponse.json(list);
  } catch (err) {
    return NextResponse.json(
      { error: "SA_LIST_ERROR", message: String(err) },
      { status: 500 }
    );
  }
}

/**
 * POST: Add symbols to the SA list.
 * Body: { "symbols": ["AAPL", "TSLA", ...] }
 */
export async function POST(request: NextRequest) {
  const authResult = await requirePremium(request);
  if (!authResult.success) return authResult.response;

  try {
    const body = await request.json();
    const symbols: string[] = body?.symbols;
    if (!Array.isArray(symbols) || symbols.length === 0) {
      return NextResponse.json(
        { error: "INVALID_BODY", message: 'Body must contain { "symbols": ["SYM1", ...] }' },
        { status: 400 }
      );
    }
    const result = await addToSAList(symbols);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: "SA_ADD_ERROR", message: String(err) },
      { status: 500 }
    );
  }
}

/**
 * PUT: Replace the entire SA list.
 * Body: { "symbols": ["SYM1", "SYM2", ...] }
 */
export async function PUT(request: NextRequest) {
  const authResult = await requirePremium(request);
  if (!authResult.success) return authResult.response;

  try {
    const body = await request.json();
    const symbols: string[] = body?.symbols;
    if (!Array.isArray(symbols)) {
      return NextResponse.json(
        { error: "INVALID_BODY", message: 'Body must contain { "symbols": [...] }' },
        { status: 400 }
      );
    }
    const result = await saveSAList(symbols);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: "SA_REPLACE_ERROR", message: String(err) },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Remove a symbol from the SA list.
 * Body: { "symbol": "AAPL" }
 */
export async function DELETE(request: NextRequest) {
  const authResult = await requirePremium(request);
  if (!authResult.success) return authResult.response;

  try {
    const body = await request.json();
    const symbol: string = body?.symbol;
    if (!symbol) {
      return NextResponse.json(
        { error: "INVALID_BODY", message: 'Body must contain { "symbol": "SYM" }' },
        { status: 400 }
      );
    }
    const result = await removeFromSAList(symbol);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: "SA_REMOVE_ERROR", message: String(err) },
      { status: 500 }
    );
  }
}
