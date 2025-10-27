import React, { useEffect, useState } from 'react';
import PatchSelector from '../patch-selector/PatchSelector';
import patchState from '../../utils/patchState';
import { useHistory } from 'react-router-dom';
import { FormattedMessage } from 'react-intl';
import { Header } from '../page';

// This component renders in the third column. Make its header match the
// column-style headers used elsewhere (see Header.js / .column-header).
export default function PatchPanel() {
  const [, setApplied] = useState(patchState.getApplied());
  const [, setLocaleMap] = useState(patchState.getLocaleMap());
  const history = useHistory();

  useEffect(() => {
    const unsubA = patchState.subscribeApplied(setApplied);
    const unsubL = patchState.subscribeLocale(setLocaleMap);
    return () => { unsubA(); unsubL(); };
  }, []);

  return (
    <div>
      <Header
        isSection
        to="/new"
        headline={<FormattedMessage id="patches.title" defaultMessage="Select Patch" />}
      />
      <div style={{ padding: 12 }}>
        <PatchSelector startExpanded onAppliedChange={() => { history.push('/new'); }} onLocaleMapChange={(m) => patchState.setLocaleMap(m)} />
      </div>
    </div>
  );
}
