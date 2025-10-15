import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FormattedMessage } from 'react-intl';
import { useLanguage } from '../../utils/useLanguage';
import { Header } from '../page';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

export default function PatchDetails() {
  const { patchId } = useParams();
  const [detail, setDetail] = useState(null);
  const { language } = useLanguage() || { language: 'en' };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`/games/patches/${patchId}/patch.json`);
        if (!res.ok) return setDetail(null);
        const j = await res.json();
        if (!mounted) return;
        setDetail(j || null);
      } catch (e) {
        if (mounted) setDetail(null);
      }
    })();
    return () => { mounted = false; };
  }, [patchId]);

  if (!patchId) return null;

  function localizedField(obj, baseKey) {
    if (!obj) return null;
    // baseKey is 'name' or 'brief': attempt name_<lang> or brief_<lang>
    const langKey = `${baseKey}_${language}`;
    if (obj[langKey]) return obj[langKey];
    // fallback to en
    const enKey = `${baseKey}_en`;
    if (obj[enKey]) return obj[enKey];
    // fallback to any string value in object
    const first = Object.values(obj).find(v => typeof v === 'string');
    if (first) return first;
    return null;
  }

  const title = localizedField(detail && detail.name, 'name') || patchId;
  const brief = localizedField(detail && detail.brief, 'brief');

  const md = brief ? String(brief) : null;
  const html = md ? DOMPurify.sanitize(marked.parse(md)) : null;

  return (
    <div>
      <Header isSection to="/new" headline={title} />
      <div className="column-details" style={{ padding: 12 }}>
        {html ? (
          <div className="patch-brief" dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <div style={{ color: '#666' }}><FormattedMessage id="patches.none" defaultMessage="(none)" /></div>
        )}
      </div>
    </div>
  );
}
