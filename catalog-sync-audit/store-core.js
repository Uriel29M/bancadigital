    const text = [item?.id, item?.seriesId, item?.title, item?.name, item?.seriesTitle, item?.originalTitle].join(" ");
    return /tomoki-kun|onnanoko/i.test(text);
  }

  const DataStore = {
    load() {
      try {
        const saved = JSON.parse(localStorage.getItem(DB_KEY));
        if (saved?.library && saved?.collections) {
          const removedItemIds = new Set([
            ...(window.REMOVED_DEFAULT_ITEM_IDS || []),
            ...(Array.isArray(saved.removedItemIds) ? saved.removedItemIds : [])
          ]);
          const legacyRemovedSeriesIds = new Set(saved.library.filter(isLegacyRemovedCatalogItem).map(item => item.seriesId || item.id));
          const isRemoved = item => removedItemIds.has(item.id) || isLegacyRemovedCatalogItem(item) || legacyRemovedSeriesIds.has(item.seriesId);
          const hadRemovedItems = saved.library.some(isRemoved);
          saved.library = saved.library.filter(item => !isRemoved(item));
          saved.collections = saved.collections.map(collection => ({
            ...collection,
            issueIds: (collection.issueIds || []).filter(id => !removedItemIds.has(id) && !legacyRemovedSeriesIds.has(id))
          }));
          const oldAbsolutePowerIds = new Map([
            ["series-absolute-power-2024-02", "series-absolute-power-2024-01"],
            ["series-absolute-power-2024-03", "series-absolute-power-2024-02"],
            ["series-absolute-power-2024-04", "series-absolute-power-2024-03"],
            ["series-absolute-power-2024-05", "series-absolute-power-2024-04"]
          ]);
          if (saved.library.some(item => item.id === "series-absolute-power-2024-05")) {
            saved.library = saved.library
              .filter(item => item.id !== "series-absolute-power-2024-01")
              .map(item => oldAbsolutePowerIds.has(item.id) ? { ...item, id: oldAbsolutePowerIds.get(item.id) } : item);
          }
          const actionAnnual3DuplicateId = "series-action-comics-2011-novos-52-Anual 03";
          const actionAnnual3CanonicalId = "series-action-comics-2011-novos-52-2014";
          if (saved.library.some(item => item.id === actionAnnual3DuplicateId)) {
            const normalizedActionItems = saved.library.map(item => item.id === actionAnnual3DuplicateId
              ? { ...item, id: actionAnnual3CanonicalId, issue: "Anual 03", year: 2014 }
              : item);
            saved.library = [...new Map(normalizedActionItems.map(item => [item.id, item])).values()];
            saved.collections = saved.collections.map(collection => ({
              ...collection,
              issueIds: [...new Set((collection.issueIds || []).map(id => id === actionAnnual3DuplicateId ? actionAnnual3CanonicalId : id))]
            }));
          }
          const defaultsById = new Map((window.DEFAULT_LIBRARY || []).map(item => [item.id, item]));
          const previousLibrary = saved.library;
          let updatedIcon13Url = false;
          saved.library = saved.library.map(item => {
            if (!/^series-shazam-2023-\d{2}$/.test(String(item.id || ""))) return item;
            return { ...item, seriesId: "series-shazam-2023", seriesTitle: item.seriesTitle || "Shazam!", title: item.title || "Shazam!" };
          });
          saved.library = saved.library.map(item => {
            if (item.id !== "series-icone-milestone-1993-013" || item.catalogEditedAt) return item;
            const defaultItem = defaultsById.get(item.id);
            if (!defaultItem?.fileUrl || item.fileUrl === defaultItem.fileUrl) return item;
            updatedIcon13Url = true;
            return { ...item, fileUrl: defaultItem.fileUrl };
          });
          let normalizedSeriesIds = false;
          saved.library = saved.library.map(item => {
            const canonicalSeriesId = canonicalSeriesIdFor(item.seriesTitle, item.seriesId);
            if (!canonicalSeriesId || item.seriesId === canonicalSeriesId) return item;
            normalizedSeriesIds = true;
            const definition = (window.DEFAULT_SERIES || []).find(series => series.id === canonicalSeriesId);
            return {
              ...item,
              seriesId: canonicalSeriesId,
              seriesTitle: item.seriesTitle || definition?.name || definition?.seriesTitle || ""
            };
          });
          saved.library = saved.library.map(item => mergeCatalogEdition(item, defaultsById.get(item.id)));
          saved.library = materializeSeriesItems(saved.library);
          this.save(saved);
          const milestoneSeriesIds = new Set((window.DEFAULT_SERIES || []).filter(series => series.imprint === "Milestone").map(series => series.id));
          const milestoneItemIds = new Set((window.DEFAULT_LIBRARY || []).filter(item => milestoneSeriesIds.has(item.seriesId)).map(item => item.id));
          const hadUnavailableMilestoneIssues = saved.library.some(item => milestoneSeriesIds.has(item.seriesId) && !milestoneItemIds.has(item.id));
          saved.library = saved.library.filter(item => !milestoneSeriesIds.has(item.seriesId) || milestoneItemIds.has(item.id));
          const hadObsoleteHardwareIssues = saved.library.some(item => item.seriesId === "series-hardware-milestone-1993" && Number(item.issue) > 16);
          saved.library = saved.library.filter(item => item.seriesId !== "series-hardware-milestone-1993" || Number(item.issue) <= 16);
          const hadLegacyIconCatalog = saved.library.some(item => item.seriesId === "series-icone-milestone-1993");
          saved.library = saved.library.filter(item => item.seriesId !== "series-icone-milestone-1993" || item.catalogEditedAt);
          const batgirlsCharacterChanged = saved.library.some(item => item.seriesId === "series-batgirls-2022" && item.character !== "Batgirl");
          if (batgirlsCharacterChanged) {
            saved.library = saved.library.map(item => item.seriesId === "series-batgirls-2022" ? { ...item, character: "Batgirl" } : item);
          }
          saved.library = saved.library.filter(item => item.seriesId !== "series-danger-street-2023" || Number(item.issue) <= 4);
          saved.library = saved.library.filter(item => item.seriesId !== "series-joker-killer-smile-2019" || Number(item.issue) <= 1);
          const hadStargirlAdvertisement = saved.library.some(item => item.id === "series-stargirl-lost-children-2022-03");
          saved.library = saved.library.filter(item => item.id !== "series-stargirl-lost-children-2022-03");
          if (hadStargirlAdvertisement) {
            saved.collections = saved.collections.map(collection => ({
              ...collection,
              issueIds: (collection.issueIds || []).filter(id => id !== "series-stargirl-lost-children-2022-03")
            }));
          }
          const knightVolumesChanged = saved.library.some(item => {
            const previous = previousLibrary.find(entry => entry.id === item.id);
            return previous && (previous.volume !== item.volume || previous.volumeTitle !== item.volumeTitle);
          });
          if (normalizedSeriesIds || updatedIcon13Url || knightVolumesChanged || hadStargirlAdvertisement || batgirlsCharacterChanged || hadUnavailableMilestoneIssues || hadObsoleteHardwareIssues || hadLegacyIconCatalog) this.save(saved);
          if (saved.library.some(item => item.id === "series-justice-godzilla-kong-2023-08" && String(item.fileUrl || "").includes("bpk2XxWKhFNO9s"))) this.save(saved);
          const knownIds = new Set(saved.library.map(item => item.id));
          const newDefaults = materializeSeriesItems(structuredClone(window.DEFAULT_LIBRARY)).filter(item => !knownIds.has(item.id) && !removedItemIds.has(item.id) && !isLegacyRemovedCatalogItem(item));
          if (newDefaults.length) {
            const merged = { ...saved, library: [...saved.library, ...newDefaults] };
            this.save(merged);
            return merged;
          }
          if (hadRemovedItems) this.save(saved);
          return saved;
        }
      } catch {}
      const fresh = {
        library: structuredClone(window.DEFAULT_LIBRARY),
        collections: structuredClone(window.DEFAULT_COLLECTIONS),
        submissions: [],
        removedItemIds: []
      };
      const removedItemIds = new Set(window.REMOVED_DEFAULT_ITEM_IDS || []);
      fresh.library = fresh.library.filter(item => !removedItemIds.has(item.id) && !isLegacyRemovedCatalogItem(item));
      fresh.collections = fresh.collections.map(collection => ({
        ...collection,
        issueIds: (collection.issueIds || []).filter(id => !removedItemIds.has(id))
      }));
      fresh.library = materializeSeriesItems(fresh.library);
      this.save(fresh);
      return fresh;
    },
    save(db) {
      const payload = JSON.stringify({ ...db, library: storageSafeLibrary(db.library) });
      try {
        localStorage.setItem(DB_KEY, payload);
      } catch (error) {
        if (error?.name !== "QuotaExceededError") throw error;
        clearGeneratedCoverCache();
        try {
          localStorage.setItem(DB_KEY, payload);
        } catch (retryError) {
          console.warn("Catálogo local maior que a cota do navegador; alterações locais não foram persistidas.", retryError);
        }
      }
    }
  };

  const state = {
