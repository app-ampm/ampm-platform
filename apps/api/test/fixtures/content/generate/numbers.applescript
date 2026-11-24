-- Numbers fixtures for the content checks (see ../README.md): a small menu table with a formula, exported
-- to Excel with and without a password.
--   osascript numbers.applescript <fixtures folder> <file stem> <open password>
on run argv
	set outDir to item 1 of argv
	set fileStem to item 2 of argv
	set openPassword to item 3 of argv
	set plainPath to outDir & "/" & fileStem & ".xlsx"
	set lockedPath to outDir & "/" & fileStem & "-password.xlsx"
	with timeout of 300 seconds
		tell application "Numbers"
			set doc to make new document
			tell table 1 of sheet 1 of doc
				set value of cell "A1" to "Sample Hotel"
				set value of cell "A2" to "Banquet Hall A"
				set value of cell "B2" to 120
				set value of cell "A3" to "Banquet Hall B"
				set value of cell "B3" to 80
				set value of cell "B4" to "=SUM(B2:B3)"
			end tell
			export doc to POSIX file plainPath as Microsoft Excel with properties {exclude summary worksheet:true}
			export doc to POSIX file lockedPath as Microsoft Excel with properties {exclude summary worksheet:true, password:openPassword, password hint:"sample"}
			close doc saving no
		end tell
	end timeout
end run
