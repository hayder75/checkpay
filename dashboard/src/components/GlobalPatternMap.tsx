import { useState, useEffect, useMemo } from 'react';
import {
    ComposableMap,
    Geographies,
    Geography,
    Marker,
    Line
} from "react-simple-maps";
import { motion, AnimatePresence } from "framer-motion";
import api from '@/lib/api';
import { Zap, Radio } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/components/ui/use-toast';

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// Country name to country code mapping (for geography data that uses names instead of codes)
const COUNTRY_NAME_TO_CODE: Record<string, string> = {
    'ETHIOPIA': 'ET',
    'KENYA': 'KE',
    'NIGERIA': 'NG',
    'GHANA': 'GH',
    'SOUTH AFRICA': 'ZA',
    'TANZANIA': 'TZ',
    'UGANDA': 'UG',
    'RWANDA': 'RW',
    'EGYPT': 'EG',
    'MOROCCO': 'MA',
    'LIBYA': 'LY',
    'SUDAN': 'SD',
    'SOUTH SUDAN': 'SS',
    'S. SUDAN': 'SS',
    'SOMALILAND': 'SO',
    'SOMALIA': 'SO',
    'DJIBOUTI': 'DJ',
    'ERITREA': 'ER',
    'CYPRUS': 'CY',
    'BOSNIA AND HERZ.': 'BA',
    'BOSNIA AND HERZEGOVINA': 'BA',
    'MACEDONIA': 'MK',
    'SERBIA': 'RS',
    'MONTENEGRO': 'ME',
    'KOSOVO': 'XK',
    'TRINIDAD AND TOBAGO': 'TT',
    'UNITED STATES': 'US',
    'UNITED KINGDOM': 'GB',
    'FRANCE': 'FR',
    'GERMANY': 'DE',
    'INDIA': 'IN',
    'CHINA': 'CN',
    'AUSTRALIA': 'AU',
    'BRAZIL': 'BR',
    'CANADA': 'CA',
    'UNITED ARAB EMIRATES': 'AE',
    'SINGAPORE': 'SG',
};

// Country code to country name mapping (for displaying names from codes)
const COUNTRY_CODE_TO_NAME: Record<string, string> = {
    'ET': 'Ethiopia',
    'KE': 'Kenya',
    'NG': 'Nigeria',
    'GH': 'Ghana',
    'ZA': 'South Africa',
    'TZ': 'Tanzania',
    'UG': 'Uganda',
    'RW': 'Rwanda',
    'EG': 'Egypt',
    'MA': 'Morocco',
    'LY': 'Libya',
    'SD': 'Sudan',
    'SS': 'South Sudan',
    'SO': 'Somalia',
    'DJ': 'Djibouti',
    'ER': 'Eritrea',
    'CY': 'Cyprus',
    'BA': 'Bosnia and Herzegovina',
    'MK': 'Macedonia',
    'RS': 'Serbia',
    'ME': 'Montenegro',
    'XK': 'Kosovo',
    'TT': 'Trinidad and Tobago',
    'US': 'United States',
    'GB': 'United Kingdom',
    'FR': 'France',
    'DE': 'Germany',
    'IN': 'India',
    'CN': 'China',
    'AU': 'Australia',
    'BR': 'Brazil',
    'CA': 'Canada',
    'AE': 'United Arab Emirates',
    'SG': 'Singapore',
};

interface CoverageData {
    code: string;
    name?: string;
    institutions?: string[];
    institutionCount?: number;
    templateCount?: number;
    count?: number; // Legacy support
    currency?: string;
    region?: string;
    latency?: string;
}

interface GeoProperties {
    iso_a2?: string;
    ISO_A2?: string;
    name?: string;
}

interface GeoObject {
    rsmKey: string;
    properties: GeoProperties;
}

// Fixed hub-to-hub arcs to show "network connectivity"
const DATA_STREAMS: Array<[[number, number], [number, number]]> = [
    [[37.9, -0.02], [8.6, 9.0]],   // Kenya -> Nigeria
    [[37.9, -0.02], [39.7, 9.1]],  //偏 Kenya -> Ethiopia
    [[8.6, 9.0], [-1.1, 52.3]],    // Nigeria -> UK
    [[37.9, -0.02], [103.8, 1.35]], // Kenya -> Singapore
];

// No mock data - show empty map when no data exists

export default function GlobalPatternMap() {
    const [coverage, setCoverage] = useState<CoverageData[]>([]);
    const [hoveredCountry, setHoveredCountry] = useState<CoverageData | null>(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const { theme } = useTheme();
    const { toast } = useToast();
    const isDark = theme === 'dark';

    useEffect(() => {
        const fetchCoverage = async () => {
            try {
                const response = await api.get('/countries/coverage');
                if (response.data.success) {
                    console.log("Coverage data fetched:", response.data.data);
                    if (response.data.data.length > 0) {
                        // Transform API data to match our interface
                        const transformedData = response.data.data.map((item: any) => ({
                            code: item.code,
                            name: item.name || COUNTRY_CODE_TO_NAME[item.code] || item.code, // Use mapping to get name from code
                            institutions: item.institutions || [],
                            institutionCount: item.institutionCount || (item.institutions ? item.institutions.length : 0),
                            templateCount: item.templateCount || 0,
                            count: item.templateCount || item.count || 0, // Legacy support
                            currency: item.currency,
                            region: item.region,
                            latency: item.latency,
                        }));
                        setCoverage(transformedData);
                    } else {
                        console.log("API returned empty coverage - no templates in system");
                        setCoverage([]); // Empty array - no mock data
                    }
                }
            } catch (error: any) {
                console.error("Failed to fetch coverage data", error);
                toast({
                    title: 'Failed to load coverage map',
                    description: error.response?.data?.error || 'Unable to fetch coverage data. Showing sample data.',
                    variant: 'destructive',
                });
                // No fallback - show empty map
                setCoverage([]);
            }
        };
        fetchCoverage();
    }, [toast]);

    const handleMouseMove = (event: React.MouseEvent) => {
        setTooltipPos({ x: event.clientX, y: event.clientY });
    };

    const isSupported = (geoCodeOrName: string) => {
        if (!geoCodeOrName || !coverage.length) {
            return null;
        }
        const upper = geoCodeOrName.toUpperCase();
        
        // First try direct code match
        let found = coverage.find(c => c.code && c.code.toUpperCase() === upper);
        
        // If not found and it looks like a country name, try mapping it to a code
        if (!found && upper.length > 2) {
            const mappedCode = COUNTRY_NAME_TO_CODE[upper];
            if (mappedCode) {
                found = coverage.find(c => c.code && c.code.toUpperCase() === mappedCode);
            }
        }
        
        // Also try name match
        if (!found) {
            found = coverage.find(c => c.name && c.name.toUpperCase() === upper);
        }
        
        return found || null;
    };

    const styles = useMemo(() => ({
        land: isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.15)",
        stroke: isDark ? "rgba(255, 255, 255, 0.5)" : "rgba(0, 0, 0, 0.3)",
        active: "#f37100",
        hoverLand: isDark ? "rgba(243, 113, 0, 0.25)" : "rgba(243, 113, 0, 0.15)",
        hoverStroke: isDark ? "rgba(255, 255, 255, 0.7)" : "rgba(243, 113, 0, 0.4)", // Lighter hover stroke
    }), [isDark]);

    return (
        <section 
            className="relative w-full py-12 md:py-16 flex flex-col items-center justify-center overflow-hidden"
            data-no-cursor-follow
            data-mask-background
        >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(249,115,22,0.2)_0%,rgba(249,115,22,0.1)_30%,rgba(249,115,22,0.05)_50%,transparent_80%)] pointer-events-none" />

            <div className="w-full relative z-10 px-4 md:px-10 lg:px-20 text-center mb-12">
                <h2 className="text-4xl md:text-6xl font-bold mb-4 tracking-tight">Verified Globally.</h2>
                <p className="text-muted-foreground text-lg max-w-2xl mx-auto opacity-70">
                    CheckPay's verification matrix spans across borders, connecting local payment methods to the global economy.
                </p>
            </div>

            <div className="relative w-full flex items-center justify-center px-4 md:px-10" onMouseMove={handleMouseMove}>
                <div className="w-full relative z-10 flex items-center justify-center">
                    <ComposableMap 
                        projectionConfig={{ rotate: [-20, 0, 0], scale: 220 }} 
                        className="w-full h-auto aspect-[21/9]"
                    >
                        <defs>
                            <filter id="continent-shadow" x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur in="SourceAlpha" stdDeviation="12" />
                                <feOffset dx="0" dy="15" result="offsetblur" />
                                <feFlood floodColor={isDark ? "rgba(249, 115, 22, 0.2)" : "rgba(249, 115, 22, 0.15)"} result="color" />
                                <feComposite in="color" in2="offsetblur" operator="in" />
                                <feMerge>
                                    <feMergeNode />
                                    <feMergeNode in="SourceGraphic" />
                                </feMerge>
                            </filter>
                        </defs>
                        <g>
                        {/* Data Streams / Arcs */}
                        {DATA_STREAMS.map((line, i) => (
                            <Line
                                key={i}
                                from={line[0]}
                                to={line[1]}
                                stroke="#f37100"
                                strokeWidth={0.5}
                                strokeLinecap="round"
                                strokeDasharray="3 3"
                                opacity={0.3}
                                style={{ pointerEvents: "none" }}
                            />
                        ))}

                        <g>
                            <Geographies geography={geoUrl}>
                                {({ geographies }: { geographies: GeoObject[] }) =>
                                    geographies.map((geo) => {
                                    const geoCode = geo.properties.iso_a2 || geo.properties.ISO_A2 || '';
                                    const geoName = geo.properties.name || '';
                                    // Filter out Antarctica and very small islands/territories for a cleaner look
                                    if (geoCode === 'AQ' || geoName === 'Antarctica') return null;
                                    
                                    // Try to find country by code first, then by name
                                    const country = isSupported(geoCode) || (geoName ? isSupported(geoName) : null);
                                    return (
                                        <Geography
                                            key={geo.rsmKey}
                                            geography={geo}
                                            onMouseEnter={(e) => {
                                                handleMouseMove(e);
                                                const foundCountry = isSupported(geoCode) || (geoName ? isSupported(geoName) : null);
                                                console.log('Mouse enter on country:', geoCode || geoName, 'Found:', foundCountry);
                                                if (foundCountry) {
                                                    setHoveredCountry(foundCountry);
                                                }
                                            }}
                                            onMouseMove={(e) => {
                                                handleMouseMove(e);
                                                const foundCountry = isSupported(geoCode) || (geoName ? isSupported(geoName) : null);
                                                if (foundCountry) {
                                                    setHoveredCountry(foundCountry);
                                                }
                                            }}
                                            onMouseLeave={() => {
                                                console.log('Mouse leave');
                                                setHoveredCountry(null);
                                            }}
                                            style={{
                                                default: {
                                                    fill: styles.land,
                                                    stroke: styles.stroke,
                                                    strokeWidth: isDark ? 0.3 : 0.2,
                                                    outline: "none",
                                                    transition: "all 400ms",
                                                    pointerEvents: "all",
                                                },
                                                hover: {
                                                    fill: country ? "rgba(243, 113, 0, 0.15)" : "rgba(243, 113, 0, 0.05)",
                                                    stroke: styles.hoverStroke,
                                                    strokeWidth: 1.5,
                                                    outline: "none",
                                                    cursor: country ? "pointer" : "default",
                                                    pointerEvents: "all",
                                                }
                                            }}
                                        />
                                    );
                                })
                            }
                        </Geographies>
                        </g>
                        </g>

                        {/* Connection Hubs */}
                        {coverage.map((c) => {
                            const coords = getCoordinates(c.code);
                            if (coords[0] === 0 && coords[1] === 0) return null;
                            return (
                                <Marker key={c.code} coordinates={coords}>
                                    <motion.g 
                                        initial={{ scale: 0 }} 
                                        animate={{ scale: 1 }} 
                                        transition={{ type: "spring" }}
                                        style={{ pointerEvents: "none" }}
                                    >
                                        {/* Outer Pulse */}
                                        <motion.circle
                                            r={10}
                                            fill="#f37100"
                                            fillOpacity={0.15}
                                            animate={{ r: [10, 25, 10], opacity: [0.15, 0, 0.15] }}
                                            transition={{ duration: 3, repeat: Infinity, ease: "easeOut" }}
                                        />
                                        <circle r={2.5} fill="#f37100" />
                                        <circle r={6} fill="transparent" stroke="#f37100" strokeWidth={0.5} strokeOpacity={0.5} />
                                    </motion.g>
                                </Marker>
                            );
                        })}
                    </ComposableMap>
                </div>
            </div>

            {/* Country Info Panel - Fixed position to not cover the map */}
            <AnimatePresence>
                {hoveredCountry && (
                    <motion.div
                        key={hoveredCountry.code}
                        initial={{ 
                            opacity: 0, 
                            scale: 0.95, 
                            x: tooltipPos.x + 20, 
                            y: tooltipPos.y - 130 
                        }}
                        animate={{ 
                            opacity: 1, 
                            scale: 1, 
                            x: tooltipPos.x + 20,
                            y: tooltipPos.y - 150
                        }}
                        exit={{ opacity: 0, scale: 0.95, x: tooltipPos.x + 20, y: tooltipPos.y - 130 }}
                        transition={{ type: "spring", damping: 30, stiffness: 300 }}
                        className="fixed z-[99999] pointer-events-none"
                        style={{ left: 0, top: 0 }}
                    >
                        <div className="w-[300px] md:w-[350px] bg-background/80 backdrop-blur-2xl border border-orange-500/30 rounded-[2rem] p-6 shadow-[0_40px_80px_-20px_rgba(249,115,22,0.3)] overflow-hidden relative">
                            {/* Decorative background glow */}
                            <div className="absolute -top-10 -right-10 w-32 h-32 bg-orange-500/10 blur-3xl rounded-full" />
                            
                            <div className="relative z-10">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/40">
                                            <Zap className="w-6 h-6 text-white fill-white" />
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-black tracking-tighter leading-none">
                                                {hoveredCountry.name || COUNTRY_CODE_TO_NAME[hoveredCountry.code] || hoveredCountry.code}
                                            </h3>
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Network Online</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Latency</div>
                                        <div className="text-sm font-mono font-bold text-orange-500">{hoveredCountry.latency || '28ms'}</div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div className="bg-foreground/5 rounded-2xl p-3 border border-foreground/5">
                                        <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Currency</div>
                                        <div className="text-sm font-bold">{hoveredCountry.currency || 'USD'}</div>
                                    </div>
                                    <div className="bg-foreground/5 rounded-2xl p-3 border border-foreground/5">
                                        <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Region</div>
                                        <div className="text-sm font-bold truncate">{hoveredCountry.region || 'Global'}</div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-muted-foreground">Templates</span>
                                        <span className="text-xs font-mono font-bold bg-orange-500/10 text-orange-600 px-2 py-0.5 rounded-full">
                                            {hoveredCountry.templateCount || hoveredCountry.count || 0} Available
                                        </span>
                                    </div>
                                    {hoveredCountry.institutions && hoveredCountry.institutions.length > 0 && (
                                        <>
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-muted-foreground">Financial Institutions</span>
                                                <span className="text-xs font-mono font-bold bg-orange-500/10 text-orange-600 px-2 py-0.5 rounded-full">
                                                    {hoveredCountry.institutionCount || hoveredCountry.institutions.length} Active
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                                {hoveredCountry.institutions.map((inst: string, idx: number) => (
                                            <span key={idx} className="px-3 py-1.5 rounded-xl bg-foreground/5 text-[10px] font-bold border border-foreground/5 hover:border-orange-500/30 transition-colors">
                                                {inst}
                                            </span>
                                        ))}
                                    </div>
                                        </>
                                    )}
                                </div>

                                <div className="mt-6 pt-4 border-t border-foreground/5">
                                    <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                        <span>Verification Matrix</span>
                                        <span>99.9% Success</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-foreground/5 rounded-full mt-2 overflow-hidden">
                                        <motion.div 
                                            initial={{ width: 0 }}
                                            animate={{ width: "99.9%" }}
                                            transition={{ duration: 1, ease: "easeOut" }}
                                            className="h-full bg-gradient-to-r from-orange-500 to-orange-400"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

                <div className="absolute top-0 right-0 w-1/3 aspect-square opacity-[0.03] pointer-events-none">
                    <svg viewBox="0 0 100 100" className="w-full h-full text-foreground/20">
                        <circle cx="100" cy="0" r="100" fill="none" stroke="currentColor" strokeWidth="0.1" />
                        <circle cx="100" cy="0" r="80" fill="none" stroke="currentColor" strokeWidth="0.1" />
                        <circle cx="100" cy="0" r="60" fill="none" stroke="currentColor" strokeWidth="0.1" />
                    </svg>
                </div>

        </section>
    );
}

function getCoordinates(code: string): [number, number] {
    const coords: Record<string, [number, number]> = {
        'KE': [37.9, -0.02], 'NG': [8.6, 9.0], 'ET': [39.7, 9.1], 'ZA': [22.9, -30.5], 'GH': [-1.0, 7.9],
        'TZ': [34.8, -6.3], 'UG': [32.3, 1.3], 'RW': [29.8, -1.9], 'SD': [30.2, 12.8], 'SO': [46.1, 5.1],
        'US': [-95.7, 37.0], 'GB': [-1.1, 52.3], 'FR': [2.2, 46.2], 'DE': [10.4, 51.1], 'IN': [78.9, 20.5],
        'CN': [104.1, 35.8], 'AU': [133.7, -25.2], 'BR': [-47.92, -15.78], 'CA': [-106.3, 56.1],
        'AE': [54.0, 24.0], 'EG': [30.8, 26.8], 'SG': [103.8, 1.35],
    };
    return coords[code] || [0, 0];
}
