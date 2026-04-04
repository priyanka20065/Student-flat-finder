
module.exports = function (app, ctx) {
  const {
    state,
    dbCollections,
    FREE_CHAT_LIMIT,
    mongoUri,
    mongoEnabled,
    imageUpload,
    razorpayEnabled,
    razorpay,
    mailEnabled,
    sendEmail,
    crypto,
    CAMPUS,
    sanitizeUser,
    makeId,
    toNumber,
    normalizeSubscriptionPlan,
    getSubscriptionDurationDays,
    getSubscriptionExpiry,
    getSubscriptionLockState,
    activateSubscription,
    toOptionalCoordinatePair,
    normalizeCoordinatePair,
    normalizeTourUrl,
    normalizeTourUrls,
    normalizeImageUrls,
    stripMongoId,
    normalizeFlat,
    normalizeRoommate,
    normalizeFlatMetrics,
    haversineDistanceKm,
    getFlatMetrics,
    getUniqueUserMessageCount,
    getOwnerFlatStats,
    getPurchasedFlatIdByUser,
    getRoommateJoinedUserIds,
    hasUserBookedAnyRoommate,
    isEligibleStudentBuyer,
    hasAnyRoomBookedByUser,
    hasRoommateSeatAvailable,
    getUserActivityCounts,
    enrichFlat,
    enrichRoommate,
    isAppGeneratedListingId,
    isActiveOwnerListing,
    isActiveRoommateListing,
    pruneUnsupportedListingsFromState,
    profileToScore,
    pushSseEvent,
    broadcastBrowseUpdate,
    broadcastChatUpdate,
    persistUser,
    persistFlat,
    deleteFlat,
    deleteChat,
    persistRoommate,
    persistChatMessages,
    persistFlatMetrics,
    deleteFlatMetrics,
    browseSubscribers,
    chatSubscribers
  } = ctx;

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      mongo: {
        configured: Boolean(mongoUri),
        connected: mongoEnabled,
      },
    })
  })

  app.get("/api/stream/browse", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream")
    res.setHeader("Cache-Control", "no-cache")
    res.setHeader("Connection", "keep-alive")
    res.flushHeaders()

    browseSubscribers.add(res)
    pushSseEvent(res, "connected", { ok: true })

    req.on("close", () => {
      browseSubscribers.delete(res)
    })
  })

  // REMOVED: /api/upload/images endpoint. Only public URLs (Cloudinary or user input) are supported for images.

  app.post("/api/auth/signup", async (req, res) => {
    const { name, email, password, intent, preferredRoomType, university, course, bio, interests, personality } = req.body || {}
    if (!name || !email || !password || !intent) {
      res.status(400).json({ message: "name, email, password and intent are required" })
      return
    }

    const normalizedIntent = String(intent || "").trim().toLowerCase()
    if (normalizedIntent !== "owner" && !String(university || "").trim()) {
      res.status(400).json({ message: "college/university is required for student signup" })
      return
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    const existingUser = Array.from(state.users.values()).find((item) => item.email === normalizedEmail)

    if (existingUser) {
      res.status(409).json({ message: "Account already exists. Please login." })
      return
    }

    const user = {
      id: makeId("usr"),
      name: String(name).trim(),
      email: normalizedEmail,
      password: String(password),
      role: intent === "owner" ? "owner" : "roommate",
      intent,
      preferredRoomType: intent === "owner" ? null : String(preferredRoomType || "room-only"),
      university: String(university || "").trim(),
      interests: Array.isArray(interests)
        ? interests.map((item) => String(item).trim()).filter(Boolean)
        : String(interests || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      course: String(course || "").trim(),
      bio: String(bio || "").trim(),
      personality: {
        cleanliness: toNumber(personality?.cleanliness, 5),
        socialLevel: toNumber(personality?.socialLevel, 5),
        studyHabits: toNumber(personality?.studyHabits, 5),
      },
      subscription: {
        plan: "Free",
        active: false,
        activatedAt: null,
      },
    }

    state.users.set(user.id, user)

    try {
      await persistUser(user)
    } catch (error) {
      console.error("Failed to persist user:", error.message)
    }

    const normalizedPreferredRoomType = String(preferredRoomType || "").trim().toLowerCase()
    const welcomeUserType =
      normalizedIntent === "owner"
        ? "flat listing owner"
        : normalizedPreferredRoomType === "room-with-roommates"
          ? "roommate listing student"
          : "student seeker"

    const emailSent = await sendEmail({
      to: user.email,
      subject: "Welcome to Student Flat Finder 389",
      text: `Hi ${user.name},\n\nWelcome to Student Flat Finder. Your account is ready as ${welcomeUserType}. You can now continue with your selected flow.\n\n- Team Student Flat Finder`,
      html: `<p>Hi <strong>${user.name}</strong>,</p><p>Welcome to <strong>Student Flat Finder</strong>. Your account is ready as <strong>${welcomeUserType}</strong>. You can now continue with your selected flow.</p><p>d Team Student Flat Finder</p>`,
    })

    res.status(201).json({
      ...sanitizeUser(user),
      emailNotification: !mailEnabled ? "email-disabled" : emailSent ? "welcome-email-sent" : "welcome-email-failed",
    })
  })

  // ...existing code...

  // GET flat details with roommate info
  app.get("/api/flats/:id", (req, res) => {
    const flatId = req.params.id;
    const flat = state.flats.find(f => f.id === flatId);
    if (!flat) {
      return res.status(404).json({ message: "Flat not found" });
    }
    let roommatesInfo = [];
    // Get current user id from session, JWT, or query param (fallback for demo)
    const currentUserId = req.user?.id || req.query.userId;
    const isOwner = currentUserId && String(flat.ownerId) === String(currentUserId);

    if (flat.flatType === "room-with-roommates" && Array.isArray(flat.roommates) && flat.roommates.length > 0) {
      console.log("[API] /api/flats/:id - Roommates for flat:", flat.id, flat.roommates);
      roommatesInfo = flat.roommates
        .map(rmId => {
          const rm = state.roommates.find(r => r.id === rmId);
          if (!rm) {
            console.warn(`[API] /api/flats/:id - Roommate ID not found in state.roommates:`, rmId);
            return null;
          }
          let user = null;
          if (rm.createdByUserId && state.users && typeof state.users.get === "function") {
            user = state.users.get(rm.createdByUserId);
          }
          if (!user) {
            console.warn(`[API] /api/flats/:id - User not found for roommate.createdByUserId:`, rm.createdByUserId);
          }
          // Return all roommate fields, fallback to user fields where appropriate
          return {
            id: rm.id,
            name: rm.name || user?.name || "-",
            email: user?.email || rm.email || "-",
            age: rm.age || user?.age || "-",
            gender: rm.gender || user?.gender || "-",
            profession: rm.profession || rm.course || user?.profession || user?.course || "-",
            course: rm.course || user?.course || "-",
            schedule: rm.schedule || user?.schedule || "-",
            cleanliness: rm.cleanliness || (rm.personality && rm.personality.cleanliness) || user?.cleanliness || "-",
            habits: rm.habits || user?.habits || "-",
            food: rm.food || user?.food || "-",
            social: rm.social || user?.social || "-",
            bio: rm.bio || user?.bio || "-",
            interests: Array.isArray(rm.interests) && rm.interests.length > 0 ? rm.interests : (Array.isArray(user?.interests) ? user.interests : []),
            preferredRentMax: rm.preferredRentMax,
            maxOccupants: rm.maxOccupants,
            moveInDate: rm.moveInDate,
            address: rm.address || user?.address || "-",
            location: rm.location,
            institution: rm.institution,
            images: Array.isArray(rm.images) ? rm.images : [],
            virtualTourUrls: Array.isArray(rm.virtualTourUrls) ? rm.virtualTourUrls : [],
            virtualTourUrl: rm.virtualTourUrl,
            createdByUserId: rm.createdByUserId,
            personality: rm.personality,
          };
        })
        .filter(Boolean);
      console.log("[API] /api/flats/:id - roommatesInfo result:", roommatesInfo);
    }
    res.json({ ...flat, roommatesInfo });
  });
}
