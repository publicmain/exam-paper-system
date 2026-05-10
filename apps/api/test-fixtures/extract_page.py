"""Quick PDF text extractor for IELTS PDF inspection.

Usage:
  python extract_page.py <start> <end>  # inclusive page range, 1-indexed

Prints the text of each page with a banner so we can find which pages
contain Reading Test 1 Passage 1 + the Answer Keys section.
"""
import sys
import fitz

PDF = r"C:\Users\yaoke\Projects\exam-paper-system\apps\api\test-fixtures\cambridge-ielts-8.pdf"

doc = fitz.open(PDF)
print(f"Total pages: {len(doc)}")
start = int(sys.argv[1]) if len(sys.argv) > 1 else 1
end = int(sys.argv[2]) if len(sys.argv) > 2 else min(start + 4, len(doc))

for i in range(start - 1, end):
    page = doc[i]
    txt = page.get_text("text")
    print(f"\n========== PAGE {i+1} ==========")
    print(txt)
