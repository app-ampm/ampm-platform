// PDFKit and Core Graphics fixtures for the content checks (see ../README.md), and the check that the
// specs' own AES-256 PDFs open in PDFKit.
//   xcrun swift pdfkit.swift make <plain.pdf> <fixtures folder> <tag>
//   xcrun swift pdfkit.swift verify <file.pdf> [open password]
import CoreGraphics
import CoreText
import Foundation
import PDFKit

let arguments = CommandLine.arguments
let owner = "owner-sample"
let open = "open-sample"

func fail(_ message: String) -> Never {
    FileHandle.standardError.write((message + "\n").data(using: .utf8)!)
    exit(1)
}

func make(source: String, folder: String, tag: String) {
    guard let document = PDFDocument(url: URL(fileURLWithPath: source)) else { fail("cannot open \(source)") }
    let ownerOnly: [PDFDocumentWriteOption: Any] = [.ownerPasswordOption: owner]
    let both: [PDFDocumentWriteOption: Any] = [.ownerPasswordOption: owner, .userPasswordOption: open]
    guard document.write(to: URL(fileURLWithPath: "\(folder)/\(tag)-aes-128-owner-only.pdf"), withOptions: ownerOnly),
          document.write(to: URL(fileURLWithPath: "\(folder)/\(tag)-aes-128-user-password.pdf"), withOptions: both)
    else { fail("PDFKit could not write") }
    // Core Graphics writes RC4 (revision 3) for a 40-bit key.
    var box = CGRect(x: 0, y: 0, width: 595, height: 842)
    let info: [CFString: Any] = [kCGPDFContextOwnerPassword: owner, kCGPDFContextEncryptionKeyLength: 40]
    let url = URL(fileURLWithPath: "\(folder)/\(tag)-coregraphics-rc4-40-owner-only.pdf") as CFURL
    guard let context = CGContext(url, mediaBox: &box, info as CFDictionary) else { fail("no context") }
    context.beginPDFPage(nil)
    context.textPosition = CGPoint(x: 72, y: 760)
    CTLineDraw(CTLineCreateWithAttributedString(NSAttributedString(string: "Sample Hotel")), context)
    context.endPDFPage()
    context.closePDF()
}

func verify(path: String, password: String?) {
    guard let document = PDFDocument(url: URL(fileURLWithPath: path)) else { fail("PDFKit cannot read \(path)") }
    if let password {
        if !document.isLocked { fail("\(path) opens without its password") }
        if !document.unlock(withPassword: password) { fail("\(path) does not open with its password") }
    } else if document.isLocked && !document.unlock(withPassword: "") {
        fail("\(path) needs a password")
    }
    guard let text = document.page(at: 0)?.string, text.contains("Sample Hotel") else {
        fail("\(path) does not show Sample Hotel")
    }
    print("PDFKit opens \(path)")
}

switch arguments.count > 1 ? arguments[1] : "" {
case "make": make(source: arguments[2], folder: arguments[3], tag: arguments[4])
case "verify": verify(path: arguments[2], password: arguments.count > 3 ? arguments[3] : nil)
default: fail("usage: pdfkit.swift make|verify …")
}
