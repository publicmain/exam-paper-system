"""Find all 'READING PASSAGE N' headings in the PDF."""
import fitz
PDF = r"C:\Users\yaoke\Projects\exam-paper-system\apps\api\test-fixtures\cambridge-ielts-8.pdf"
doc = fitz.open(PDF)
for i, page in enumerate(doc, 1):
    txt = page.get_text("text").upper()
    if "READING PASSAGE 1" in txt or "READING PASSAGE 2" in txt or "READING PASSAGE 3" in txt:
        # find which one + first 80 chars after for context
        for n in [1,2,3]:
            marker = f"READING PASSAGE {n}"
            idx = txt.find(marker)
            if idx >= 0:
                # take 200 chars after the marker for the passage title
                snippet = txt[idx:idx+200].replace("\n", " | ")
                print(f"p{i}: {marker} -> {snippet[:200]}")
