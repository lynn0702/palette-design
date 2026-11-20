"""Create a 2-up landscape saddle-stitch printer spread PDF from any multiple-of-4 single-page PDF (4, 8, 12, 16+ pages).

Supports:
  --sheet a4     A4 landscape (297 x 210 mm) for A5 pages at exact 100% scale, flip on short edge.
  --sheet letter US Letter landscape (11 x 8.5 in) scaled cleanly to fit half-letter with zero gutter overlap.
"""

import argparse
from pypdf import PageObject, PdfReader, PdfWriter, Transformation

MM_TO_PT = 72.0 / 25.4
SHEETS = {
    "a4": (297.0 * MM_TO_PT, 210.0 * MM_TO_PT),  # 841.89 x 595.28 pt (A5 2-up)
    "letter": (792.0, 612.0),                     # 11.0 x 8.5 in (Half-Letter 2-up)
}


def saddle_stitch_pairs(page_count: int) -> list[tuple[int, int]]:
    if page_count < 4 or page_count % 4 != 0:
        raise ValueError(f"Saddle-stitch requires a multiple of 4 pages, got {page_count}")
    pairs: list[tuple[int, int]] = []
    sheets = page_count // 4
    for s in range(sheets):
        # Front of sheet (outer): (last - 2s, first + 2s)
        pairs.append((page_count - 1 - 2 * s, 2 * s))
        # Back of sheet (inner): (first + 2s + 1, last - 2s - 1)
        pairs.append((2 * s + 1, page_count - 2 - 2 * s))
    return pairs


def impose_saddle_stitch(single_pdf_path: str, out_pdf_path: str, sheet_key: str = "a4") -> None:
    reader = PdfReader(single_pdf_path)
    page_count = len(reader.pages)
    spread_pairs = saddle_stitch_pairs(page_count)
    sheet_w_pt, sheet_h_pt = SHEETS[sheet_key]
    half_w_pt = sheet_w_pt / 2.0

    writer = PdfWriter()
    for left_idx, right_idx in spread_pairs:
        sheet = PageObject.create_blank_page(width=sheet_w_pt, height=sheet_h_pt)
        left_page = reader.pages[left_idx]
        right_page = reader.pages[right_idx]

        lw = float(left_page.mediabox.width)
        lh = float(left_page.mediabox.height)
        rw = float(right_page.mediabox.width)
        rh = float(right_page.mediabox.height)

        l_scale = min(1.0, half_w_pt / lw, sheet_h_pt / lh)
        r_scale = min(1.0, half_w_pt / rw, sheet_h_pt / rh)

        l_tx = (half_w_pt - lw * l_scale) / 2.0
        l_ty = (sheet_h_pt - lh * l_scale) / 2.0
        r_tx = half_w_pt + (half_w_pt - rw * r_scale) / 2.0
        r_ty = (sheet_h_pt - rh * r_scale) / 2.0

        sheet.merge_transformed_page(left_page, Transformation().scale(l_scale, l_scale).translate(tx=l_tx, ty=l_ty))
        sheet.merge_transformed_page(right_page, Transformation().scale(r_scale, r_scale).translate(tx=r_tx, ty=r_ty))
        writer.add_page(sheet)

    with open(out_pdf_path, "wb") as fh:
        writer.write(fh)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input_single_pdf")
    parser.add_argument("output_printer_spreads_pdf")
    parser.add_argument("--sheet", choices=("a4", "letter"), default="a4")
    args = parser.parse_args()
    impose_saddle_stitch(args.input_single_pdf, args.output_printer_spreads_pdf, args.sheet)
    print(f"Wrote 2-up {args.sheet.upper()} saddle-stitch PDF: {args.output_printer_spreads_pdf}")


if __name__ == "__main__":
    main()
