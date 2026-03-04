import {
  DatabaseBlockDataSource,
  databaseBlockProperties,
} from '@blocksuite/affine/blocks/database';
import type { DatabaseBlockModel } from '@blocksuite/affine/model';
import type { DataViewDataType } from '@blocksuite/data-view';
import { Text } from '@blocksuite/store';
import { beforeEach, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { setupEditor } from '../utils/setup.js';

type RowData = {
  name: string;
  age: string;
};

type SortRule = {
  ref: {
    type: 'ref';
    name: string;
  };
  desc: boolean;
};

type SortableViewData = DataViewDataType & {
  sort?: {
    sortBy: SortRule[];
    manuallySort: string[];
  };
};

beforeEach(async () => {
  const cleanup = await setupEditor('page');
  return cleanup;
});

test('database sort with multiple rules', async () => {
  const rootId = doc.root?.id;
  if (!rootId) {
    throw new Error('Cannot find root block');
  }

  const noteId = doc.addBlock('affine:note', {}, rootId);
  const databaseId = doc.addBlock(
    'affine:database',
    {
      title: new Text('Database 1'),
    },
    noteId
  );
  const database = doc.getBlock(databaseId)?.model as
    | DatabaseBlockModel
    | undefined;
  if (!database) {
    throw new Error('Cannot find database model');
  }

  const dataSource = new DatabaseBlockDataSource(database);
  const tableViewId = dataSource.viewManager.viewAdd('table');

  const nameColumnId = dataSource.propertyAdd('end', {
    type: databaseBlockProperties.richTextColumnConfig.type,
    name: 'Name',
  });
  const ageColumnId = dataSource.propertyAdd('end', {
    type: databaseBlockProperties.richTextColumnConfig.type,
    name: 'Age',
  });
  if (!nameColumnId || !ageColumnId) {
    throw new Error('Failed to create database columns');
  }

  const rows: RowData[] = [
    { name: 'Alice', age: '25' },
    { name: 'Bob', age: '30' },
    { name: 'Alice', age: '20' },
    { name: 'Charlie', age: '25' },
  ];

  for (const row of rows) {
    const rowId = doc.addBlock(
      'affine:paragraph',
      {
        text: new Text(row.name),
      },
      databaseId
    );
    dataSource.cellValueChange(rowId, nameColumnId, new Text(row.name));
    dataSource.cellValueChange(rowId, ageColumnId, new Text(row.age));
  }

  const setSortRules = (sortBy: SortRule[]) => {
    dataSource.viewDataUpdate<SortableViewData>(tableViewId, data => ({
      sort: {
        ...(data.sort ?? { sortBy: [], manuallySort: [] }),
        sortBy,
      },
    }));
  };

  const getRowOrder = () => {
    const view = dataSource.viewManager.currentView$.value;
    if (!view) {
      throw new Error('Cannot find current table view');
    }
    return view.rows$.value.map(row => ({
      name:
        view.cellGetOrCreate(row.rowId, nameColumnId).stringValue$.value ?? '',
      age:
        view.cellGetOrCreate(row.rowId, ageColumnId).stringValue$.value ?? '',
    }));
  };

  setSortRules([
    { ref: { type: 'ref', name: nameColumnId }, desc: false },
    { ref: { type: 'ref', name: ageColumnId }, desc: false },
  ]);
  await wait();
  expect(getRowOrder()).toEqual([
    { name: 'Alice', age: '20' },
    { name: 'Alice', age: '25' },
    { name: 'Bob', age: '30' },
    { name: 'Charlie', age: '25' },
  ]);

  setSortRules([
    { ref: { type: 'ref', name: nameColumnId }, desc: true },
    { ref: { type: 'ref', name: ageColumnId }, desc: false },
  ]);
  await wait();
  expect(getRowOrder()).toEqual([
    { name: 'Charlie', age: '25' },
    { name: 'Bob', age: '30' },
    { name: 'Alice', age: '20' },
    { name: 'Alice', age: '25' },
  ]);

  setSortRules([{ ref: { type: 'ref', name: ageColumnId }, desc: false }]);
  await wait();
  expect(getRowOrder()).toEqual([
    { name: 'Alice', age: '20' },
    { name: 'Alice', age: '25' },
    { name: 'Charlie', age: '25' },
    { name: 'Bob', age: '30' },
  ]);
});
