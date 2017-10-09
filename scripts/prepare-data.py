#!/usr/bin/env python3

import sys
import io
import os
import shutil
import datetime
import csv
import json
import numbers
import collections

def main(source_filepath, output_dirpath):
  # Recreate output.
  if os.path.exists(output_dirpath):
    shutil.rmtree(output_dirpath)
  os.mkdir(output_dirpath)
  # Collect outputs.
  outputs = collections.defaultdict(list) # Map of (src, dst) => flights[]
  connections = collections.defaultdict(set) # Map of src => dst[]
  failed_to_parse_count = 0
  parsed_count = 0
  missing_delay_count = 0
  with io.open(source_filepath, 'r', encoding='ascii') as f:
    for i, row in enumerate(csv.DictReader(f)):
      try:
        src, dst, departed_on, delay_in_minutes, duration_in_minutes = parse_row(row)
      except Exception as ex:
        failed_to_parse_count += 1
        print('Error parsing row, skipping.', file=sys.stderr)
        print('Error:\n', ex, file=sys.stderr)
        print('Row #{}:\n'.format(i + 2), row, file=sys.stderr)
        continue
      else:
        parsed_count += 1
      # Update connections map.
      connections[src].add(dst)
      # Push to "departed on" column.
      col_departed_on = outputs[(src, dst, 'departedOn')]
      col_departed_on.append(maybe_truncate_to_int(departed_on.timestamp()))
      # Push to "delay in minutes" column.
      if delay_in_minutes is None:
        # Assuming empty delay means no delay.
        delay_in_minutes = 0
        missing_delay_count += 1
      col_delay_in_minutes = outputs.setdefault((src, dst, 'delayInMinutes'), [])
      col_delay_in_minutes.append(maybe_truncate_to_int(delay_in_minutes))
      # Push to "delay ratio" column.
      delay_ratio = round(delay_in_minutes / duration_in_minutes, 2) # Remove excessive precision.
      col_delay_ratio = outputs.setdefault((src, dst, 'delayRatio'), [])
      col_delay_ratio.append(delay_ratio)
  # Write connections map.
  for key in connections:
    # Convert sets to lists for JSON serialization.
    connections[key] = list(connections[key])
  with io.open(os.path.join(output_dirpath, 'connections.json'), 'w') as f:
    json.dump(connections, f, separators=(',', ':'))
  # Write partitioned data columns.
  for key, col_data in outputs.items():
    col_filename = 'p-{}.json'.format('-'.join(key))
    with io.open(os.path.join(output_dirpath, col_filename), 'w') as f:
      json.dump(col_data, f, separators=(',', ':'))
  processed_count = parsed_count + failed_to_parse_count
  print('Processed total of', processed_count, 'rows')
  if missing_delay_count:
    print('Coerced missing "delay" to 0 in', missing_delay_count, '({:.2f}%)'.format(missing_delay_count * 100 / processed_count), 'rows')
  if failed_to_parse_count:
    print('Failed to parse', failed_to_parse_count, '({:.2f}%)'.format(failed_to_parse_count * 100 / processed_count), 'rows')
  if failed_to_parse_count:
    sys.exit(1)

def parse_row(row):
  src, dst = row['ORIGIN'], row['DEST']
  departed_on = datetime.datetime.strptime(row['FL_DATE'] + row['CRS_DEP_TIME'], '%Y-%m-%d%H%M')
  raw_delay_in_minutes = row["ARR_DELAY"]
  delay_in_minutes = None if raw_delay_in_minutes == '' else float(raw_delay_in_minutes) # Locale-independent.
  duration_in_minutes = float(row['CRS_ELAPSED_TIME'])
  return src, dst, departed_on, delay_in_minutes, duration_in_minutes

def maybe_truncate_to_int(n):
  assert isinstance(n, numbers.Number)
  try:
    i = int(n)
  except:
    return n
  return i if i == n else n

if __name__ == '__main__':
  main(*sys.argv[1:])
