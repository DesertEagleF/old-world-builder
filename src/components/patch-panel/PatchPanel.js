import React, { useEffect } from 'react';
import PatchSelector from '../patch-selector/PatchSelector';
import patchState from '../../utils/patchState';
import { FormattedMessage } from 'react-intl';
import { Header } from '../page';

// This component renders in the third column. Make its header match the
// column-style headers used elsewhere (see Header.js / .column-header).
export default function PatchPanel({ isMobile }) {
  useEffect(() => {
    const unsubA = patchState.subscribeApplied((applied) => {
      console.log('PatchPanel: applied patches changed:', applied);
    });
    const unsubL = patchState.subscribeLocale((locale) => {
      console.log('PatchPanel: locale changed:', locale);
      // Just log the locale change, don't update state to avoid potential loops
    });
    return () => { unsubA(); unsubL(); };
  }, []);

  return (
    <div>
      <Header
        isSection
        to="?new"
        headline={<FormattedMessage id="patches.title" defaultMessage="Select Patch" />}
      />
      <div style={{ padding: 12 }}>
        <PatchSelector
          startExpanded
          onAppliedChange={(appliedPatches) => {
            // Parent component will handle the patches
            console.log('Patches applied:', appliedPatches);
          }}
          onLocaleMapChange={(m) => patchState.setLocaleMap(m)}
        />
      </div>
    </div>
  );
}