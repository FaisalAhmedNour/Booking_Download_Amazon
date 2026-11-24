// Which tab started the current engine process.
// Both tabs stay mounted and the engine broadcasts every event to all listeners
// (it has no off* methods), so each tab ignores events from runs it did not start.

export const PROCESS_OWNER = {
    DOWNLOAD_PO: 'download_po',
    VMS_STATUS: 'vms_status',
};

let currentOwner = null;

export const setProcessOwner = (owner) => {
    currentOwner = owner;
};

export const getProcessOwner = () => currentOwner;

/** True when `owner` started the current run, or when no tab has started one in this session. */
export const isProcessOwnedBy = (owner) => currentOwner === null || currentOwner === owner;
