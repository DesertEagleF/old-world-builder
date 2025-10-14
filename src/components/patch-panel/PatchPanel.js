import React, { useEffect, useState } from 'react';
import PatchSelector from '../patch-selector/PatchSelector';
import patchState from '../../utils/patchState';
import { useHistory } from 'react-router-dom';
import { Button } from '../button';
import { FormattedMessage } from 'react-intl';

// This component renders in the third column. Make its header match the
// column-style headers used elsewhere (see Header.js / .column-header).
export default function PatchPanel() {
  const [applied, setApplied] = useState(patchState.getApplied());
  const [localeMap, setLocaleMap] = useState(patchState.getLocaleMap());
  const history = useHistory();

  useEffect(() => {
    const unsubA = patchState.subscribeApplied(setApplied);
    const unsubL = patchState.subscribeLocale(setLocaleMap);
    return () => { unsubA(); unsubL(); };
  }, []);

  return (
    <div>
      <div className="column-header" style={{ padding: '0.5rem 1rem', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <h1 className="header__name" style={{ margin: 0 }}>
            <span className="header__name-text"><FormattedMessage id="patches.title" defaultMessage="Select Patch" /></span>
          </h1>
        </div>
        <div>
          <Button type="text" icon="close" onClick={() => history.push('/new')} color="dark" />
        </div>
      </div>
      <div style={{ padding: 12 }}>
        <PatchSelector startExpanded onAppliedChange={() => { history.push('/new'); }} onLocaleMapChange={(m) => patchState.setLocaleMap(m)} />
      </div>
    </div>
  );
}
