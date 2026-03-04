"use client";

import { useEffect, useState, useRef } from "react";
import { firebaseDb as db, generateId as id } from "@/lib/firebase-client";
import { tx } from "@/lib/firebase-tx";

export interface Voice {
  id?: string;
  voice_id: string;
  name: string;
  category: string;
  description?: string;
  preview_url?: string;
}

interface VoiceSelectorProps {
  selectedVoiceId?: string;
  onVoiceSelect: (voiceId: string) => void;
}

export const VoiceSelector: React.FC<VoiceSelectorProps> = ({
  selectedVoiceId,
  onVoiceSelect,
}) => {
  // Database Query for Cached Voices
  const { data, isLoading: isDbLoading } = db.useQuery({ voices: {} });
  const [fetchedVoices, setFetchedVoices] = useState<Voice[]>([]);
  
  // Combine sources: prefer DB if available, otherwise use fetched
  const voicesFromDb = (data && 'voices' in data ? data.voices : []) as Voice[];
  const displayVoices: Voice[] = voicesFromDb.length > 0 ? voicesFromDb : fetchedVoices;
  
  console.log("VoiceSelector debug:", { dbCount: voicesFromDb.length, fetchedCount: fetchedVoices.length, selected: selectedVoiceId });

  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  const toggleFilter = (tag: string) => {
      setActiveFilters(prev => 
        prev.includes(tag) ? prev.filter(f => f !== tag) : [...prev, tag]
      );
  };

  const filteredVoices = displayVoices.filter((voice) => {
      const matchesSearch = voice.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            voice.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (voice.description && voice.description.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesFilters = activeFilters.length === 0 || activeFilters.every(filter => {
          const content = (voice.name + " " + voice.category + " " + (voice.description || "")).toLowerCase();
          return content.includes(filter.toLowerCase());
      });

      return matchesSearch && matchesFilters;
  });

  const [isLoadingApi, setIsLoadingApi] = useState(false);
  const hasAttemptedFetch = useRef(false);
  const [isOpen, setIsOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  // Fetch from API if DB is empty or has stale data
  const fetchAndCacheVoices = async (force = false) => {
      // Relaxed condition: if less than 5 voices, trigger a refresh/sync
      // If we already have fetched voices, we don't need to spam api
      const needsSync = voicesFromDb.length < 5 && fetchedVoices.length === 0;
      
      if (!isDbLoading && (needsSync || force) && !isLoadingApi && (!hasAttemptedFetch.current || force)) {
        hasAttemptedFetch.current = true;
        setIsLoadingApi(true);
        try {
            console.log("Fetching fresh voices from API...");
            const response = await fetch("/api/voices");
            if (!response.ok) throw new Error("Failed to fetch voices");
            const data = await response.json();
            
            const apiVoices: Voice[] = (data.voices || []).filter((v: Voice) => !!v.voice_id && !!v.name);
            
            if (apiVoices.length > 0) {
               // IMMEDIATE UI UPDATE
               setFetchedVoices(apiVoices);

               // Attempt Background Cache (Fail silently if permissions deny)
               // ... logic to update DB ...
               try {
                   // Map existing voices to their UUIDs for updates
                   const voiceIdToUuidMap = new Map<string, string>();
                   voicesFromDb.forEach((v: any) => {
                       if (v.voice_id && v.id) {
                           voiceIdToUuidMap.set(v.voice_id, v.id);
                       }
                   });

                   // Verify if we need to clean stale (only if we have db access)
                   if (voicesFromDb.length > 0) {
                       const staleIds = voicesFromDb
                           .filter((v) => !apiVoices.some((av) => av.voice_id === v.voice_id))
                           .map((v) => v.id) // Use the UUID to delete
                           .filter(Boolean) as string[];

                       if (staleIds.length > 0) {
                           type DbWithTransact = typeof db & { transact: (txns: unknown[]) => Promise<void> };
                           await (db as DbWithTransact).transact(staleIds.map((uuid: string) => tx.voices[uuid].delete()));
                       }
                   }

                   const chunkSize = 20;
                   for (let i = 0; i < apiVoices.length; i += chunkSize) {
                       const chunk = apiVoices.slice(i, i + chunkSize);
                       const txs = chunk.map(v => {
                         // Use existing UUID if available, otherwise generate new one
                         const entityId = voiceIdToUuidMap.get(v.voice_id) || id();
                         
                         return tx.voices[entityId].update({
                            voice_id: v.voice_id,
                            name: v.name,
                            category: v.category || "premade",
                            description: v.description || "",
                            preview_url: v.preview_url || ""
                         })
                       });
                       type DbWithTransact = typeof db & { transact: (txns: unknown[]) => Promise<void> };
                       await (db as DbWithTransact).transact(txs);
                   }
                   console.log("Voices cached to DB successfully.");
               } catch (dbErr) {
                   console.warn("Could not cache voices to DB (likely permission issue), using local state only.", dbErr);
               }
            }
        } catch (err) {
            console.error("Error caching voices:", err);
        } finally {
            setIsLoadingApi(false);
        }
      }
    };

  useEffect(() => {
    fetchAndCacheVoices();
  }, [isDbLoading, voicesFromDb.length, isLoadingApi, fetchedVoices.length, voicesFromDb]); // Added voicesFromDb to dep array


  const handlePlayPreview = async (e: React.MouseEvent, voice: Voice) => {
    e.stopPropagation();

    // If clicking same voice, toggle off
    if (playingVoiceId === voice.voice_id) {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
        setPlayingVoiceId(null);
        return;
    }

    // Stop previous
    if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
    }

    if (!voice.preview_url) return;

    try {
        const audio = new Audio(voice.preview_url);
        audioRef.current = audio;
        setPlayingVoiceId(voice.voice_id);
        
        await audio.play();
        
        audio.onended = () => {
            setPlayingVoiceId(null);
            audioRef.current = null;
        };

    } catch (err) {
        console.error("Playback failed:", err);
        setPlayingVoiceId(null);
    }
  };

  // Auto-select first voice if selectedVoiceId is invalid/missing but we have voices
  useEffect(() => {
      // Check against displayVoices (combined list)
      if (displayVoices.length > 0 && !displayVoices.find((v: Voice) => v.voice_id === selectedVoiceId)) {
          console.log("Selected voice not found, defaulting to first available.");
          onVoiceSelect(displayVoices[0].voice_id);
      }
  }, [displayVoices, selectedVoiceId, onVoiceSelect]); // Updated dep

  const selectedVoice = displayVoices.find((v: Voice) => v.voice_id === selectedVoiceId);

  return (
    <div className="space-y-2">
     
      
      <div className={`relative ${isOpen ? 'z-[100]' : 'z-auto'}`}>
        {/* Dropdown Trigger */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between p-3 bg-white dark:bg-[#101322] border border-slate-200 dark:border-[#232948] rounded-xl hover:border-blue-500 transition-colors text-left"
        >
           {selectedVoice ? (
               <div className="flex items-center gap-3">
                   <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                        {selectedVoice.name.charAt(0)}
                   </div>
                   <div>
                       <div className="font-semibold text-slate-900 dark:text-white leading-tight">{selectedVoice.name}</div>
                       <div className="text-xs text-slate-500">{selectedVoice.category}</div>
                   </div>
               </div>
           ) : (
               <span className="text-slate-500">Select a voice...</span>
           )}
           <span className="material-symbols-outlined text-slate-400">arrow_drop_down</span>
        </button>

        {/* Dropdown Content */}
        {isOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-[#191e33] border border-slate-200 dark:border-[#232948] rounded-xl shadow-xl z-50 max-h-[400px] flex flex-col">
                {/* Search & Filter Header */}
                <div className="p-3 border-b border-slate-100 dark:border-[#232948] space-y-2 sticky top-0 bg-white dark:bg-[#191e33] z-10 rounded-t-xl">
                    <div className="relative">
                        <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                        <input 
                            type="text" 
                            placeholder="Search voices..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-[#101322] border border-slate-200 dark:border-[#232948] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar" onClick={(e) => e.stopPropagation()}>
                        {['Male', 'Female', 'American', 'British', 'Australian'].map(tag => (
                            <button
                                key={tag}
                                onClick={() => toggleFilter(tag)}
                                className={`px-2 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
                                    activeFilters.includes(tag) 
                                        ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700' 
                                        : 'bg-white dark:bg-[#191e33] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-[#232948] hover:border-slate-300'
                                }`}
                            >
                                {tag}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="overflow-y-auto flex-1">
                    {isDbLoading || isLoadingApi ? (
                        <div className="p-4 text-center text-slate-500 text-sm">Loading voices...</div>
                    ) : filteredVoices.length === 0 ? (
                        <div className="p-4 text-center text-slate-500 text-sm flex flex-col gap-2">
                            <span>No voices match your filters.</span>
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                fetchAndCacheVoices(true);
                            }}
                            className="text-blue-600 font-bold text-xs hover:underline"
                        >
                            Try fetching again
                        </button>
                    </div>
                ) : (
                    filteredVoices.map((voice) => (
                        <div 
                            key={voice.voice_id}
                            onClick={() => {
                                onVoiceSelect(voice.voice_id);
                                setIsOpen(false);
                            }}
                            className={`flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-[#232948] cursor-pointer border-b border-slate-100 dark:border-[#232948] last:border-0 ${selectedVoiceId === voice.voice_id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                        >
                             <div className="flex items-center gap-3">
                                <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs ${selectedVoiceId === voice.voice_id ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-[#101322] text-slate-500'}`}>
                                        {voice.name.charAt(0)}
                                </div>
                                <div>
                                    <div className={`font-semibold text-sm ${selectedVoiceId === voice.voice_id ? 'text-blue-600 dark:text-blue-400' : 'text-slate-900 dark:text-white'}`}>
                                        {voice.name}
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                                        {voice.description || voice.category}
                                    </div>
                                </div>
                             </div>

                             {voice.preview_url && (
                                 <button
                                    onClick={(e) => handlePlayPreview(e, voice)}
                                    className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-500"
                                 >
                                     <span className="material-symbols-outlined text-xl">
                                         {playingVoiceId === voice.voice_id ? 'stop' : 'play_arrow'}
                                     </span>
                                 </button>
                             )}
                        </div>
                    ))
                )}
            </div>
            </div>
        )}
      </div>
      
      {/* Backdrop to close */}
      {isOpen && (
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
      )}
    </div>
  );
};
