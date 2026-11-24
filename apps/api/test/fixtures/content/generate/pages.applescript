-- A Pages fixture for the content checks (see ../README.md): a Word export, which every upload refuses.
--   osascript pages.applescript <fixtures folder> <file stem>
-- (Variables avoid iWork terms: "tag" is a Pages property, "return" a Pages class.)
on run argv
	set outDir to item 1 of argv
	set fileStem to item 2 of argv
	set sampleText to "Sample Hotel" & (character id 10) & "Banquet Hall A"
	set wordPath to outDir & "/" & fileStem & ".docx"
	with timeout of 300 seconds
		tell application "Pages"
			set doc to make new document
			set body text of doc to sampleText
			export doc to POSIX file wordPath as Microsoft Word
			close doc saving no
		end tell
	end timeout
end run
