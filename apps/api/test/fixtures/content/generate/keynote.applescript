-- Keynote fixtures for the content checks (see ../README.md): one slide with "Sample Hotel", a capacity
-- chart (Keynote embeds its data as a workbook), exported to PowerPoint and PDF, with and without a password.
--   osascript keynote.applescript <fixtures folder> <file stem> <open password>
on run argv
	set outDir to item 1 of argv
	set fileStem to item 2 of argv
	set openPassword to item 3 of argv
	set base to outDir & "/" & fileStem
	with timeout of 300 seconds
		tell application "Keynote"
			set doc to make new document with properties {document theme:theme "White"}
			tell slide 1 of doc
				set object text of default title item to "Sample Hotel"
				set object text of default body item to "Banquet Hall A"
			end tell
			add chart slide 1 of doc row names {"Banquet Hall A"} column names {"Guests"} data {{120}} type vertical_bar_2d group by chart column
			export doc to POSIX file (base & ".pptx") as Microsoft PowerPoint
			export doc to POSIX file (base & "-password.pptx") as Microsoft PowerPoint with properties {password:openPassword, password hint:"sample"}
			export doc to POSIX file (base & ".pdf") as PDF
			export doc to POSIX file (base & "-password.pdf") as PDF with properties {password:openPassword, password hint:"sample"}
			close doc saving no
		end tell
	end timeout
end run
