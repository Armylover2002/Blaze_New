export const applySoftDelete = (doc, performer = null) => {
    doc.isDeleted = true;
    doc.deletedAt = new Date();
    doc.deletedBy = performer || null;
    if (performer) {
        doc.updatedBy = performer;
    }
};
