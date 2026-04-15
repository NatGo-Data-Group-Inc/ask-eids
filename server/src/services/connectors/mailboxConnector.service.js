function firstMeaningfulLine(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) || '';
}

export function normalizeEmailBody(input) {
  const lines = String(input || '').split(/\r?\n/);
  const output = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^On .+wrote:$/i.test(trimmed)) {
      break;
    }
    if (/^From:\s/i.test(trimmed) && output.length > 0) {
      break;
    }
    if (trimmed.startsWith('>')) {
      continue;
    }
    if (/confidentiality notice/i.test(trimmed) || /this email and any attachments/i.test(trimmed)) {
      break;
    }
    output.push(line);
  }
  return output.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function baseMailboxMessages() {
  return [
    {
      providerMessageId: 'mail-msg-1001',
      cursor: 1001,
      conversationId: 'thread-77',
      subject: 'FHIR test timeline approved',
      from: 'jaden@example.mil',
      to: ['dr.sohl@example.mil', 'lowry@example.mil'],
      sentAt: '2026-04-12T14:14:00.000Z',
      bodyText: [
        'Per Wednesday’s decision, revised schedule attached.',
        '',
        'Action owner: Lowry to confirm by EOD Friday.',
        '',
        'On Wed, Apr 10, 2026 at 3:05 PM Dr. Sohl wrote:',
        '> Prior thread content',
        '',
        'CONFIDENTIALITY NOTICE: This email and any attachments are intended only for authorized recipients.',
      ].join('\n'),
      attachments: [
        {
          attachmentId: 'att-001',
          fileName: 'revised-fhir-schedule.txt',
          mimeType: 'text/plain',
          content: 'FHIR revised schedule milestone table.',
        },
      ],
    },
    {
      providerMessageId: 'mail-msg-1002',
      cursor: 1002,
      conversationId: 'thread-78',
      subject: 'Sprint 2 stakeholder alignment',
      from: 'pm-hub@example.mil',
      to: ['dental-team@example.mil'],
      sentAt: '2026-04-13T09:05:00.000Z',
      bodyText: 'Stakeholder alignment confirmed for the revised milestone baseline.',
      attachments: [],
    },
  ];
}

function mailboxNewMessage() {
  return {
    providerMessageId: 'mail-msg-1003',
    cursor: 1003,
    conversationId: 'thread-79',
    subject: 'Vendor committed updated test environment date',
    from: 'vendor@example.com',
    to: ['jaden@example.mil'],
    sentAt: '2026-04-14T11:10:00.000Z',
    bodyText: 'Vendor confirmed delivery by next Tuesday. Decision: continue with integrated test plan.',
    attachments: [],
  };
}

export function getMailboxMessages({ testCase = '' }) {
  const messages = baseMailboxMessages();
  if (testCase === 'mailboxNewMessage') {
    messages.push(mailboxNewMessage());
  }
  return messages;
}

export function buildMailboxSyncDelta({
  profile,
  existingSources = [],
  nextSourceId = 1,
  testCase = '',
}) {
  if (testCase === 'mailboxFailure') {
    throw new Error('Injected mailbox connector failure');
  }

  const lastCursor = Number(profile?.lastCursor || 0);
  const existingExternalRefs = new Set(existingSources.map((source) => source.externalRef).filter(Boolean));
  const inbound = getMailboxMessages({ testCase }).filter((message) => Number(message.cursor) > lastCursor);

  const newSources = [];
  const timelineEntries = [];
  const sourceContents = {};
  let cursor = lastCursor;
  let sourceCounter = nextSourceId;
  let attachmentCount = 0;

  for (const message of inbound) {
    cursor = Math.max(cursor, Number(message.cursor));
    if (existingExternalRefs.has(message.providerMessageId)) {
      continue;
    }
    const normalizedBody = normalizeEmailBody(message.bodyText);
    const previewText = firstMeaningfulLine(normalizedBody);
    const emailSourceId = `src-${sourceCounter++}`;
    const participants = [...new Set([message.from, ...(message.to || [])])];
    newSources.push({
      id: emailSourceId,
      type: 'email',
      sourceSubtype: 'connector-mailbox',
      externalRef: message.providerMessageId,
      title: message.subject,
      date: message.sentAt.split('T')[0],
      meta: `Thread · ${message.conversationId} · ${message.attachments.length} attachments`,
      previewText,
      author: message.from,
      participants,
      contentType: 'message/rfc822',
      metadata: {
        conversationId: message.conversationId,
        providerMessageId: message.providerMessageId,
      },
      openable: true,
    });
    sourceContents[emailSourceId] = normalizedBody;
    timelineEntries.push({
      id: `evt-${emailSourceId}`,
      type: 'email',
      timeLabel: new Date(message.sentAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      title: message.subject,
      detail: previewText,
      sourceRef: { sourceId: emailSourceId, label: message.subject },
    });

    for (const attachment of message.attachments) {
      attachmentCount += 1;
      const attachmentSourceId = `src-${sourceCounter++}`;
      newSources.push({
        id: attachmentSourceId,
        type: 'attachment',
        sourceSubtype: 'mailbox-attachment',
        externalRef: `${message.providerMessageId}:${attachment.attachmentId}`,
        title: `Attachment: ${attachment.fileName}`,
        date: message.sentAt.split('T')[0],
        meta: `Attachment · ${attachment.fileName}`,
        previewText: firstMeaningfulLine(attachment.content),
        author: message.from,
        participants,
        contentType: attachment.mimeType || 'application/octet-stream',
        metadata: {
          parentSourceId: emailSourceId,
          parentExternalRef: message.providerMessageId,
          attachmentId: attachment.attachmentId,
        },
        openable: true,
      });
      sourceContents[attachmentSourceId] = attachment.content;
    }
  }

  return {
    newSources,
    sourceContents,
    timelineEntries,
    nextCursor: cursor,
    nextSourceId: sourceCounter,
    metrics: {
      messagesSeen: inbound.length,
      messagesIngested: newSources.filter((source) => source.type === 'email').length,
      attachmentsIngested: attachmentCount,
      duplicatesSuppressed: Math.max(0, inbound.length - newSources.filter((source) => source.type === 'email').length),
    },
  };
}
