import os
from pypdf import PdfReader

def extract_pdf():
    pdf_path = "IELTS Mock Test 2_Listening.pdf"
    if not os.path.exists(pdf_path):
        print(f"Error: File {pdf_path} not found!")
        return

    print("Extracting text from PDF...")
    reader = PdfReader(pdf_path)
    print(f"Total Pages: {len(reader.pages)}")

    full_text = ""
    for idx, page in enumerate(reader.pages):
        text = page.extract_text()
        full_text += f"\n--- PAGE {idx+1} ---\n{text}"

    # Write full text to a file for analysis
    output_path = "extracted_pdf_content.txt"
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(full_text)
    print(f"Successfully extracted to {output_path}!")

if __name__ == "__main__":
    extract_pdf()
