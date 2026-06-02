import fitz  # PyMuPDF
import os

def extract_with_fitz():
    pdf_path = "IELTS Mock Test 2_Listening.pdf"
    if not os.path.exists(pdf_path):
        print(f"Error: {pdf_path} not found!")
        return

    print("Opening PDF with PyMuPDF...")
    doc = fitz.open(pdf_path)
    print(f"Pages: {len(doc)}")

    full_text = ""
    for idx, page in enumerate(doc):
        text = page.get_text()
        full_text += f"\n--- SECTION/PAGE {idx+1} ---\n{text}"

    with open("extracted_pdf_fitz.txt", "w", encoding="utf-8") as f:
        f.write(full_text)
    print("Successfully extracted to extracted_pdf_fitz.txt!")

if __name__ == "__main__":
    extract_with_fitz()
