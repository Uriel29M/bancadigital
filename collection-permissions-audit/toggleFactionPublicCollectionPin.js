  async function toggleFactionPublicCollectionPin(button, factionId = currentFactionId()) {
    const collectionId = String(button.dataset.factionPublicCatalogPin || "");
    if (!factionId || !collectionId || !state.session?.user?.id) return;
    const pinned = button.dataset.factionPublicCatalogPinned === "true";
    const result = await sb.rpc("toggle_faction_public_collection_pin", { p_faction_id: factionId, p_collection_id: collectionId, p_pinned: !pinned });
    if (result.error) return toast(result.error.message || "Não foi possível atualizar o destaque da coleção pública.");
    const mapKey = `${factionId}:${collectionId}`;
    if (pinned) state.factionPinnedPublicCollections.delete(mapKey);
    else state.factionPinnedPublicCollections.set(mapKey, { faction_id: factionId, collection_id: collectionId });
    render();
  }

  const CHAT_ROOMS = [
    { id: "geral", name: "Chat Geral", access: "public" },
    { id: "decenautas", name: "Decenautas", access: "public" },
    { id: "marvetes", name: "Marvetes", access: "public" },
    { id: "leitores-colecionadores", name: "Leitores e Colecionadores", access: "premium" },
    { id: "staff", name: "Chat da Staff", access: "staff" },
    { id: "faccao-aurora-rubra", name: "Maravilhas", access: "faction", factionId: "aurora-rubra" },
    { id: "faccao-vigilia-cobalto", name: "Legado", access: "faction", factionId: "vigilia-cobalto" },
    { id: "faccao-forja-dourada", name: "Ruptura", access: "faction", factionId: "forja-dourada" },
    { id: "faccao-nevoa-violeta", name: "Horizonte", access: "faction", factionId: "nevoa-violeta" }
  ];
  const SHERIFF_ROOM_IDS = new Set(["geral", "decenautas", "marvetes", "leitores-colecionadores"]);
  const isSheriffRoom = room => Boolean(room && SHERIFF_ROOM_IDS.has(room.id) && !room.factionId);
  const isFactionChatSheriff = (room, userId) => Boolean(room?.factionId && userId && state.factionRoles.some(role => role.faction_id === room.factionId && role.user_id === userId && ["leader", "curator"].includes(role.role)));
  const factionChatSheriffIds = room => new Set((state.factionRoles || []).filter(role => role.faction_id === room?.factionId && ["leader", "curator"].includes(role.role)).map(role => String(role.user_id)));

