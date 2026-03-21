"""
extract_words.py
Bridge: pdfplumber -> JSON stdout
Output format: { pages: [ { page: int, words: [WordToken], tables: [Table] } ] }
"""
import sys
import json
import pdfplumber

def extract(pdf_path: str) -> dict:
    result = []

    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, 1):
            # Extract word tokens with full coordinate data
            words = page.extract_words(
                x_tolerance=3,
                y_tolerance=3,
                keep_blank_chars=False,
                use_text_flow=False
            )

            # Extract tables for structured sections (Free Float, Beneficiary)
            raw_tables = page.extract_tables({
                "vertical_strategy": "lines",
                "horizontal_strategy": "lines",
                "snap_tolerance": 3,
                "join_tolerance": 3,
            })

            # Normalize word tokens
            word_list = []
            for w in words:
                word_list.append({
                    "text": w["text"],
                    "x0": round(w["x0"], 2),
                    "x1": round(w["x1"], 2),
                    "top": round(w["top"], 2),
                    "bottom": round(w["bottom"], 2),
                })

            # Normalize tables (replace None with empty string)
            table_list = []
            if raw_tables:
                for tbl in raw_tables:
                    cleaned = []
                    for row in tbl:
                        cleaned.append([cell if cell is not None else "" for cell in row])
                    table_list.append(cleaned)

            result.append({
                "page": page_num,
                "width": round(page.width, 2),
                "height": round(page.height, 2),
                "words": word_list,
                "tables": table_list,
            })

    return {"pages": result}


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: extract_words.py <pdf_path>"}))
        sys.exit(1)

    pdf_path = sys.argv[1]
    try:
        data = extract(pdf_path)
        print(json.dumps(data, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)