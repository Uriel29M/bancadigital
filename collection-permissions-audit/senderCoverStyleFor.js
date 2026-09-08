  function senderCoverStyleFor(item, publicCollection = null) {
    const collectionStyle = publicCollection?.coverStyles?.[item?.id]
      || (item?.seriesId && publicCollection?.coverStyles?.[item.seriesId]);
    if (["normal", "grayscale", "gold"].includes(collectionStyle)) return collectionStyle;
    const userStyle = state.coverStyles.get(item?.id) || (item?.seriesId && state.coverStyles.get(item.seriesId));
    return ["normal", "grayscale", "gold"].includes(userStyle) ? userStyle : "normal";
  }

