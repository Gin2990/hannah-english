import os
from pypdf import PdfReader, PdfWriter

def split_pdf():
    pdf_path = "IELTS Mock Test 2_Listening.pdf"
    if not os.path.exists(pdf_path):
        print(f"Error: File {pdf_path} not found!")
        return

    print("Splitting PDF page-by-page...")
    reader = PdfReader(pdf_path)
    total_pages = len(reader.pages)
    print(f"Total Pages found: {total_pages}")

    for idx, page in enumerate(reader.pages):
        writer = PdfWriter()
        writer.add_page(page)
        output_filename = f"IELTS_Mock_Test_2_Listening_Part{idx+1}.pdf"
        with open(output_filename, "wb") as out_f:
            writer.write(out_f)
        print(f"Saved {output_filename}")

    print("Successfully split PDF!")

if __name__ == "__main__":
    split_pdf()
