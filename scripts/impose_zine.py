"""Create a 2-up US Letter landscape saddle-stitch printer spread PDF from a 4-page Half-Letter PDF.

Imposition order for 4-page bifold zine (11.0 x 8.5 in landscape, flip on short edge):
  Sheet 1 (Front / Outer): Left = Page 4 (Back Cover), Right = Page 1 (Front Cover)
  Sheet 2 (Back / Inner):  Left = Page 2,              Right = Page 3
"""

import argparse
from pypdf import PageObject, PdfReader, PdfWriter, Transformation

LETTER_W_PT = 792.0   # 11.0 in
LETTER_H_PT = 612.0   # 8.5 in
HALF_W_PT = 396.0     # 5.5 in


def impose_4page_bifold(single_pdf_path: str, out_pdf_path: str) -> None:
    reader = PdfReader(single_pdf_path)
    if len(reader.pages) != 4:
        raise ValueError(f"Expected exactly 4 pages in {single_pdf_path}, got {len(reader.pages)}")

    writer = PdfWriter()
    spread_pairs = [
        (3, 0),  # Sheet 1: Page 4 (index 3) left, Page 1 (index 0) right
        (1, 2),  # Sheet 2: Page 2 (index 1) left, Page 3 (index 2) right
    ]

    for left_idx, right_idx in spread_pairs:
        sheet = PageObject.create_blank_page(width=LETTER_W_PT, height=LETTER_H_PT)
        left_page = reader.pages[left_idx]
        right_page = reader.pages[right_idx]

        # Scale/center safety if source differs slightly from 396x612; at exact 396x612 tx is exact.
        lw = float(left_page.mediabox.width)
        lh = float(left_page.mediabox.height)
        rw = float(right_page.mediabox.width)
        rh = float(right_page.mediabox.height)

        l_tx = (HALF_W_PT - lw) / 2.0
        l_ty = (LETTER_H_PT - lh) / 2.0
        r_tx = HALF_W_PT + (HALF_W_PT - rw) / 2.0
        r_ty = (LETTER_H_PT - rh) / 2.0

        sheet.merge_transformed_page(left_page, Transformation().translate(tx=l_tx, ty=l_ty))
        sheet.merge_transformed_page(right_page, Transformation().translate(tx=r_tx, ty=r_ty))
        writer.add_page(sheet)

    with open(out_pdf_path, "wb") as fh:
        writer.write(fh)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input_single_pdf")
    parser.add_argument("output_printer_spreads_pdf")
    args = parser.parse_args()
    impose_4page_bifold(args.input_single_pdf, args.output_printer_spreads_pdf)
    print(f"Wrote 2-up US Letter saddle-stitch PDF: {args.output_printer_spreads_pdf}")


if __name__ == "__main__":
    main()
