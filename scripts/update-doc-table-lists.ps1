param(
  [string]$DocsRoot = "docs"
)

$ErrorActionPreference = "Stop"

function Get-Slug {
  param([string]$Heading)
  $slug = $Heading.ToLowerInvariant()
  $slug = [regex]::Replace($slug, "[^\p{L}\p{Nd}\s-]", "")
  $slug = [regex]::Replace($slug.Trim(), "\s+", "-")
  return $slug
}

function Get-CleanHeading {
  param([string]$Line)
  $heading = [regex]::Replace($Line, "^#+\s*", "").Trim()
  $heading = [regex]::Replace($heading, "^\d+(\.\d+)*\.\s*", "")
  return $heading
}

function Get-MarkdownTables {
  param([string[]]$Lines)

  $tables = New-Object System.Collections.Generic.List[object]
  $inFence = $false
  $currentHeading = ""
  $currentAnchor = ""
  $i = 0

  while ($i -lt $Lines.Count) {
    $line = $Lines[$i]

    if ($line -match '^\s*```') {
      $inFence = -not $inFence
      $i++
      continue
    }

    if ((-not $inFence) -and ($line -match '^#{1,6}\s+')) {
      $currentHeading = Get-CleanHeading $line
      $currentAnchor = Get-Slug $currentHeading
    }

    $nextLine = if ($i + 1 -lt $Lines.Count) { $Lines[$i + 1] } else { "" }
    $isTableStart = (-not $inFence) -and
      ($line -match '^\s*\|.*\|\s*$') -and
      ($nextLine -match '^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$')

    if ($isTableStart) {
      $headers = $line.Trim().Trim("|").Split("|") | ForEach-Object { $_.Trim() } | Where-Object { $_ }
      $title = if ($currentHeading) { $currentHeading } else { "Bảng dữ liệu" }
      $summary = if ($headers.Count -gt 0) { ($headers -join ", ") } else { "Các cột dữ liệu" }
      $tables.Add([pscustomobject]@{
        Title = $title
        Anchor = $currentAnchor
        Summary = $summary
      })

      $i += 2
      while (($i -lt $Lines.Count) -and ($Lines[$i] -match '^\s*\|.*\|\s*$')) {
        $i++
      }
      continue
    }

    $i++
  }

  return $tables
}

function New-TableListSection {
  param([object[]]$Tables)

  $section = New-Object System.Collections.Generic.List[string]
  $section.Add("## Danh sách bảng")
  $section.Add("")

  if ($Tables.Count -eq 0) {
    $section.Add("Tài liệu này không có bảng.")
  } else {
    for ($i = 0; $i -lt $Tables.Count; $i++) {
      $table = $Tables[$i]
      $label = "Bảng {0}. {1} - {2}" -f ($i + 1), $table.Title, $table.Summary
      if ($table.Anchor) {
        $section.Add("- [$label](#$($table.Anchor))")
      } else {
        $section.Add("- $label")
      }
    }
  }

  $section.Add("")
  return $section.ToArray()
}

function Remove-MarkdownGeneratedCaptions {
  param([string[]]$Lines)

  $cleaned = New-Object System.Collections.Generic.List[string]
  for ($i = 0; $i -lt $Lines.Count; $i++) {
    if (($Lines[$i] -match '^\*\*Bảng \d+\. .+\*\*\s*$') -and
      ($i + 1 -lt $Lines.Count) -and
      ([string]::IsNullOrWhiteSpace($Lines[$i + 1]) -or $Lines[$i + 1] -match '^\s*\|.*\|\s*$')) {
      if (($i + 1 -lt $Lines.Count) -and [string]::IsNullOrWhiteSpace($Lines[$i + 1])) {
        $i++
      }
      continue
    }

    $cleaned.Add($Lines[$i])
  }

  return $cleaned.ToArray()
}

function Add-MarkdownCaptions {
  param(
    [string[]]$Lines,
    [object[]]$Tables
  )

  $updated = New-Object System.Collections.Generic.List[string]
  $inFence = $false
  $tableIndex = 0
  $i = 0

  while ($i -lt $Lines.Count) {
    $line = $Lines[$i]

    if ($line -match '^\s*```') {
      $inFence = -not $inFence
      $updated.Add($line)
      $i++
      continue
    }

    $nextLine = if ($i + 1 -lt $Lines.Count) { $Lines[$i + 1] } else { "" }
    $isTableStart = (-not $inFence) -and
      ($line -match '^\s*\|.*\|\s*$') -and
      ($nextLine -match '^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$')

    if ($isTableStart) {
      if (($updated.Count -gt 0) -and -not [string]::IsNullOrWhiteSpace($updated[$updated.Count - 1])) {
        $updated.Add("")
      }

      $table = $Tables[$tableIndex]
      $caption = "**Bảng {0}. {1} - {2}.**" -f ($tableIndex + 1), $table.Title, $table.Summary
      $updated.Add($caption)
      $updated.Add("")
      $tableIndex++
    }

    $updated.Add($line)
    $i++
  }

  return $updated.ToArray()
}

function Update-MarkdownDocument {
  param([string]$Path)

  $text = [System.IO.File]::ReadAllText($Path)
  $text = $text -replace "`r`n", "`n"
  $lines = $text -split "`n", -1
  if ($lines.Count -gt 0 -and $lines[-1] -eq "") {
    $lines = $lines[0..($lines.Count - 2)]
  }

  $filtered = New-Object System.Collections.Generic.List[string]
  $skip = $false
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match '^## Danh sách bảng\s*$') {
      $skip = $true
      continue
    }

    if ($skip -and ($lines[$i] -match '^##\s+')) {
      $skip = $false
    }

    if (-not $skip) {
      $filtered.Add($lines[$i])
    }
  }

  while ($filtered.Count -gt 0 -and [string]::IsNullOrWhiteSpace($filtered[$filtered.Count - 1])) {
    $filtered.RemoveAt($filtered.Count - 1)
  }

  $filtered = [System.Collections.Generic.List[string]](Remove-MarkdownGeneratedCaptions $filtered.ToArray())
  $tables = Get-MarkdownTables $filtered.ToArray()
  $filtered = [System.Collections.Generic.List[string]](Add-MarkdownCaptions $filtered.ToArray() $tables)
  $section = New-TableListSection $tables

  $insertAt = 0
  if (($filtered.Count -gt 0) -and ($filtered[0] -match '^#\s+')) {
    $insertAt = 1
    while ($insertAt -lt $filtered.Count -and [string]::IsNullOrWhiteSpace($filtered[$insertAt])) {
      $insertAt++
    }
  }

  $updated = New-Object System.Collections.Generic.List[string]
  for ($i = 0; $i -lt $insertAt; $i++) {
    $updated.Add($filtered[$i])
  }
  if ($updated.Count -gt 0 -and -not [string]::IsNullOrWhiteSpace($updated[$updated.Count - 1])) {
    $updated.Add("")
  }
  $section | ForEach-Object { $updated.Add($_) }
  for ($i = $insertAt; $i -lt $filtered.Count; $i++) {
    $updated.Add($filtered[$i])
  }

  $output = ($updated.ToArray() -join "`n") + "`n"
  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $output, $encoding)
}

function Get-CleanTexHeading {
  param([string]$Line)
  $match = [regex]::Match($Line, '\\(?:section|subsection)\*?\{(.+)\}')
  if ($match.Success) {
    return $match.Groups[1].Value.Trim()
  }
  return ""
}

function Get-CleanTexHeader {
  param([string]$Line)
  $header = $Line -replace '\\textbf\{([^}]*)\}', '$1'
  $header = $header -replace '\\\\', ''
  $header = $header -replace '\\[a-zA-Z]+\s*', ''
  $header = $header -replace '\{|\}', ''
  $parts = $header.Split("&") | ForEach-Object { $_.Trim() } | Where-Object { $_ }
  if ($parts.Count -gt 0) {
    return ($parts -join ", ")
  }
  return "Các cột dữ liệu"
}

function Get-TexTables {
  param([string[]]$Lines)

  $tables = New-Object System.Collections.Generic.List[object]
  $currentHeading = ""
  for ($i = 0; $i -lt $Lines.Count; $i++) {
    if ($Lines[$i] -match '^\\(?:section|subsection)\*?\{') {
      $heading = Get-CleanTexHeading $Lines[$i]
      if ($heading) {
        $currentHeading = $heading
      }
    }

    if ($Lines[$i] -match '\\begin\{longtable\}') {
      $summary = "Các cột dữ liệu"
      for ($j = $i + 1; $j -lt $Lines.Count; $j++) {
        if ($Lines[$j] -match '\\end\{longtable\}') {
          break
        }
        if ($Lines[$j] -match '\\(?:toprule|midrule|bottomrule|hline)') {
          continue
        }
        if ($Lines[$j] -match '&') {
          $summary = Get-CleanTexHeader $Lines[$j]
          break
        }
      }

      $title = if ($currentHeading) { $currentHeading } else { "Bảng dữ liệu" }
      $tables.Add([pscustomobject]@{
        Title = $title
        Summary = $summary
      })
    }
  }

  return $tables
}

function New-TexTableListSection {
  param([object[]]$Tables)

  $section = New-Object System.Collections.Generic.List[string]
  $section.Add("\section*{Danh sách bảng}")
  $section.Add("\addcontentsline{toc}{section}{Danh sách bảng}")
  $section.Add("")

  if ($Tables.Count -eq 0) {
    $section.Add("Tài liệu này không có bảng.")
    $section.Add("")
  } else {
    $section.Add("\begin{itemize}")
    for ($i = 0; $i -lt $Tables.Count; $i++) {
      $table = $Tables[$i]
      $section.Add(("  \item Bảng {0}. {1} -- {2}." -f ($i + 1), $table.Title, $table.Summary))
    }
    $section.Add("\end{itemize}")
    $section.Add("")
  }

  return $section.ToArray()
}

function Remove-TexGeneratedCaptions {
  param([string[]]$Lines)

  $cleaned = New-Object System.Collections.Generic.List[string]
  for ($i = 0; $i -lt $Lines.Count; $i++) {
    if (($Lines[$i] -match '^\\caption\{.+\}\\\\\s*$') -and
      ($i -gt 0) -and
      ($Lines[$i - 1] -match '\\begin\{longtable\}')) {
      continue
    }

    $cleaned.Add($Lines[$i])
  }

  return $cleaned.ToArray()
}

function Add-TexCaptions {
  param(
    [string[]]$Lines,
    [object[]]$Tables
  )

  $updated = New-Object System.Collections.Generic.List[string]
  $tableIndex = 0

  for ($i = 0; $i -lt $Lines.Count; $i++) {
    $updated.Add($Lines[$i])

    if ($Lines[$i] -match '\\begin\{longtable\}') {
      $table = $Tables[$tableIndex]
      $caption = "\caption{{{0} -- {1}.}}\\" -f $table.Title, $table.Summary
      $updated.Add($caption)
      $tableIndex++
    }
  }

  return $updated.ToArray()
}

function Update-TexDocument {
  param([string]$Path)

  $text = [System.IO.File]::ReadAllText($Path)
  $text = $text -replace "`r`n", "`n"
  $lines = $text -split "`n", -1
  if ($lines.Count -gt 0 -and $lines[-1] -eq "") {
    $lines = $lines[0..($lines.Count - 2)]
  }

  $filtered = New-Object System.Collections.Generic.List[string]
  $skip = $false
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match '^\\section\*\{Danh sách bảng\}') {
      $skip = $true
      continue
    }

    if ($skip) {
      $isGeneratedTableListLine =
        [string]::IsNullOrWhiteSpace($lines[$i]) -or
        ($lines[$i] -match '^\\addcontentsline\{toc\}\{section\}\{Danh sách bảng\}') -or
        ($lines[$i] -match '^\\begin\{itemize\}') -or
        ($lines[$i] -match '^\\end\{itemize\}') -or
        ($lines[$i] -match '^\s*\\item Bảng \d+\.') -or
        ($lines[$i] -match '^Tài liệu này không có bảng\.$')

      if ($isGeneratedTableListLine) {
        continue
      }

      $skip = $false
    }

    if (-not $skip) {
      $filtered.Add($lines[$i])
    }
  }

  while ($filtered.Count -gt 0 -and [string]::IsNullOrWhiteSpace($filtered[$filtered.Count - 1])) {
    $filtered.RemoveAt($filtered.Count - 1)
  }

  $filtered = [System.Collections.Generic.List[string]](Remove-TexGeneratedCaptions $filtered.ToArray())
  $tables = Get-TexTables $filtered.ToArray()
  $filtered = [System.Collections.Generic.List[string]](Add-TexCaptions $filtered.ToArray() $tables)
  $section = New-TexTableListSection $tables

  $insertAt = -1
  for ($i = 0; $i -lt $filtered.Count; $i++) {
    if ($filtered[$i] -match '^\\end\{center\}') {
      $insertAt = $i + 1
      break
    }
  }
  if ($insertAt -lt 0) {
    for ($i = 0; $i -lt $filtered.Count; $i++) {
      if ($filtered[$i] -match '^\\begin\{document\}') {
        $insertAt = $i + 1
        break
      }
    }
  }
  if ($insertAt -lt 0) {
    $insertAt = 0
  }

  $updated = New-Object System.Collections.Generic.List[string]
  for ($i = 0; $i -lt $insertAt; $i++) {
    $updated.Add($filtered[$i])
  }
  $updated.Add("")
  $section | ForEach-Object { $updated.Add($_) }
  for ($i = $insertAt; $i -lt $filtered.Count; $i++) {
    $updated.Add($filtered[$i])
  }

  $output = ($updated.ToArray() -join "`n") + "`n"
  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $output, $encoding)
}

Get-ChildItem -Path $DocsRoot -Recurse -File -Filter "*.md" |
  ForEach-Object { Update-MarkdownDocument $_.FullName }

Get-ChildItem -Path $DocsRoot -Recurse -File -Filter "*.tex" |
  ForEach-Object { Update-TexDocument $_.FullName }
