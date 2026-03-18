import { useState, useEffect, useRef, useMemo } from "react";
import Map, { Marker, Source, Layer, useMap, MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  allEntities,
  mockEvents,
  BAISHIZHOU_CENTER,
  BaseEntity,
} from "../data/mockData";
import {
  User,
  Home as HomeIcon,
  Briefcase,
  TriangleAlert as AlertTriangle,
  Camera as CameraIcon,
  LocateFixed,
  Navigation,
  MapPin,
  LayoutGrid,
  Building2,
  Mic,
  Sparkles,
  ChevronLeft,
  RefreshCw,
  Star,
  Share2,
  Shield,
  Car,
  Factory,
  Radio
} from "lucide-react";
import { cn } from "../lib/utils";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { BuildingDetailSheet } from "../components/BuildingDetailSheet";
import { BuildingTechPanel } from "../components/BuildingTechPanel";
import { EventProfile } from "./EventProfile";

const getIcon = (type: string, isSelected?: boolean) => {
  const baseClass = cn(
    "w-8 h-8 rounded-full flex items-center justify-center border-2 border-white transition-all duration-300",
    isSelected 
      ? "scale-125 ring-4 ring-white/90 shadow-[0_0_20px_rgba(59,130,246,0.6)] z-50" 
      : "scale-100 shadow-lg"
  );
  
  switch (type) {
    case 'person': return <div className={cn(baseClass, "bg-blue-500 text-white")}><User size={16} /></div>;
    case 'house': return <div className={cn(baseClass, "bg-green-500 text-white")}><HomeIcon size={16} /></div>;
    case 'enterprise': return <div className={cn(baseClass, "bg-orange-500 text-white")}><Briefcase size={16} /></div>;
    case 'event': return <div className={cn(baseClass, "bg-red-500 text-white")}><AlertTriangle size={16} /></div>;
    case 'building': return <div className={cn(baseClass, "bg-teal-500 text-white")}><Building2 size={16} /></div>;
    case 'camera': return <div className={cn(baseClass, "bg-teal-500 text-white")}><CameraIcon size={16} /></div>;
    case 'land': return <div className={cn(baseClass, "bg-[#2dd4bf] text-white")}><MapPin size={16} /></div>;
    case 'ownership': return <div className={cn(baseClass, "bg-[#f59e0b] text-white")}><Shield size={16} /></div>;
    case 'parking': return <div className={cn(baseClass, "bg-[#3b82f6] text-white")}><Car size={16} /></div>;
    case 'industry': return <div className={cn(baseClass, "bg-[#8b5cf6] text-white")}><Factory size={16} /></div>;
    case 'iot': return <div className={cn(baseClass, "bg-[#06b6d4] text-white")}><Radio size={16} /></div>;
    default: return <div className={cn(baseClass, "bg-gray-500 text-white")}><MapPin size={16} /></div>;
  }
};

const quickActions = [
  {
    icon: LayoutGrid,
    label: "全部",
    color: "bg-[#3b66f5]",
    path: "/search",
  },
  {
    icon: Building2,
    label: "楼栋",
    color: "bg-[#2dd4bf]",
    path: "/search?type=building",
  },
  {
    icon: HomeIcon,
    label: "房屋",
    color: "bg-[#8b5cf6]",
    path: "/search?type=house",
  },
  {
    icon: AlertTriangle,
    label: "事件",
    color: "bg-[#f59e0b]",
    path: "/search?type=event",
  },
  {
    icon: CameraIcon,
    label: "摄像头",
    color: "bg-[#f97316]",
    path: "/search?type=camera",
  },
];

// Skyworth Building 3D geometry (approximate)
const skyworthBuildingGeoJSON = {
  type: 'FeatureCollection',
  features: [
    // East-West Glass Wings (No podium, starts from ground)
    {
      type: 'Feature',
      properties: { height: 120, min_height: 0, color: '#8ba5ba' }, // Realistic glass blue-grey
      geometry: {
        type: 'Polygon',
        coordinates: [[[113.9645, 22.53985], [113.9655, 22.53985], [113.9655, 22.54015], [113.9645, 22.54015], [113.9645, 22.53985]]]
      }
    },
    // North-South Main Tower (Starts from ground)
    {
      type: 'Feature',
      properties: { height: 150, min_height: 0, color: '#6b8296' }, // Darker glass/steel core
      geometry: {
        type: 'Polygon',
        coordinates: [[[113.96485, 22.5396], [113.96515, 22.5396], [113.96515, 22.5404], [113.96485, 22.5404], [113.96485, 22.5396]]]
      }
    },
    // Roof Core / Mechanical Penthouse
    {
      type: 'Feature',
      properties: { height: 160, min_height: 150, color: '#cbd5e1' }, // Steel/Concrete
      geometry: {
        type: 'Polygon',
        coordinates: [[[113.9649, 22.5399], [113.9651, 22.5399], [113.9651, 22.5401], [113.9649, 22.5401], [113.9649, 22.5399]]]
      }
    }
  ]
};

const emptyStyle = {
  version: 8 as const,
  name: "Empty",
  sources: {},
  layers: [],
  light: {
    anchor: "viewport" as const,
    color: "white",
    intensity: 0.4,
    position: [1.5, 90, 80]
  }
};

export function Home() {
  const [activeLayers, setActiveLayers] = useState<Set<string>>(
    new Set(["person", "house", "enterprise", "event", "camera", "land", "building", "ownership", "parking", "industry"]),
  );
  const [selectedEntity, setSelectedEntity] = useState<BaseEntity | null>(null);
  const [mapType, setMapType] = useState<"streets" | "satellite">("satellite");
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState("实时快讯");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const isEventProfile = location.pathname.startsWith('/event-profile/');
  const eventIdFromPath = isEventProfile ? location.pathname.split('/event-profile/')[1] : null;
  const mapRef = useRef<MapRef>(null);

  const handleStatChange = (layerId: string) => {
    setActiveLayers(prev => {
      const next = new Set(prev);
      next.add(layerId);
      return next;
    });
  };

  useEffect(() => {
    const entityId = isEventProfile ? eventIdFromPath : searchParams.get('entityId');
    if (entityId) {
      const entity = allEntities.find(e => e.id === entityId);
      if (entity) {
        setSelectedEntity(entity);
        setSheetExpanded(false);
        if (mapRef.current) {
          let targetLng = entity.lng;
          let targetLat = entity.lat;
          
          if (entity.type === 'house') {
            const house = entity as any;
            if (house.buildingId) {
              const bld = allEntities.find(e => e.id === house.buildingId);
              if (bld) {
                targetLng = bld.lng;
                targetLat = bld.lat;
              }
            }
          }

          let paddingBottom = 0;
          let targetZoom = 18;
          let targetPitch = 60;

          if (entity.type === 'building' || entity.type === 'house') {
            paddingBottom = window.innerHeight * 0.55;
            targetZoom = 16.8; // Zoom out slightly to fit the tall building
            targetPitch = 65; // Tilt more to see the building height
          } else {
            paddingBottom = 250; // Approximate height of the smaller bottom panel
          }

          mapRef.current.flyTo({
            center: [targetLng, targetLat],
            zoom: targetZoom,
            pitch: targetPitch,
            padding: { top: 50, bottom: paddingBottom },
            duration: 1000
          });
        }
      }
    } else {
      setSelectedEntity(null);
    }
  }, [searchParams, eventIdFromPath, isEventProfile]);

  const handleCloseEntity = () => {
    setSelectedEntity(null);
    if (isEventProfile) {
      navigate('/');
    } else if (searchParams.has('entityId')) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('entityId');
      navigate(`/?${newParams.toString()}`, { replace: true });
    }
  };

  const entityIdParam = searchParams.get('entityId');

  const filteredEntities = allEntities.filter((e) => {
    if (isEventProfile) {
      return e.id === eventIdFromPath;
    }
    if (entityIdParam) {
      return e.id === entityIdParam;
    }
    return activeLayers.has(e.type);
  });

  const handleLocate = () => {
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [BAISHIZHOU_CENTER[1], BAISHIZHOU_CENTER[0]],
        zoom: 16,
        pitch: 45,
        padding: { top: 0, bottom: 0 },
        duration: 1000
      });
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-gray-100 overflow-hidden">
      {/* Floating Action Buttons (Right Side) */}
      {!isEventProfile && (
        <div className={cn(
          "absolute right-4 top-4 z-[1000] flex flex-col gap-3 pointer-events-none transition-all duration-300"
        )}>
          <button
            onClick={() =>
              setMapType((t) => (t === "streets" ? "satellite" : "streets"))
            }
            className="bg-white w-[46px] h-[46px] flex items-center justify-center rounded-xl shadow-lg text-gray-700 hover:text-blue-600 pointer-events-auto active:bg-gray-50 font-black text-[15px]"
          >
            {mapType === "streets" ? "3D" : "2D"}
          </button>
          <button
            onClick={handleLocate}
            className="bg-white p-3 rounded-xl shadow-lg text-gray-700 hover:text-blue-600 pointer-events-auto active:bg-gray-50"
          >
            <LocateFixed size={22} />
          </button>
        </div>
      )}

      {/* Map Container */}
      <div className="absolute inset-0 z-0">
        <Map
          ref={mapRef}
          initialViewState={{
            longitude: BAISHIZHOU_CENTER[1],
            latitude: BAISHIZHOU_CENTER[0],
            zoom: 16,
            pitch: 45,
            bearing: -17.6
          }}
          mapStyle={emptyStyle}
          style={{ width: '100%', height: '100%' }}
          onClick={(e) => {
            const features = e.features;
            if (features && features.length > 0) {
              const feature = features.find(f => f.layer.id === '3d-buildings');
              if (feature) {
                navigate(`/?entityId=bld-1`);
                return;
              }
            }
            handleCloseEntity();
          }}
          interactiveLayerIds={['3d-buildings']}
        >
          {/* Base Maps */}
          <Source id="osm" type="raster" tiles={["https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"]} tileSize={256}>
            <Layer id="osm-layer" type="raster" layout={{ visibility: mapType === 'streets' ? 'visible' : 'none' }} />
          </Source>
          <Source id="esri" type="raster" tiles={["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"]} tileSize={256}>
            <Layer id="esri-layer" type="raster" layout={{ visibility: mapType === 'satellite' ? 'visible' : 'none' }} />
          </Source>

          <Source id="skyworth-building" type="geojson" data={skyworthBuildingGeoJSON as any}>
            <Layer
              id="3d-buildings"
              type="fill-extrusion"
              paint={{
                'fill-extrusion-color': selectedEntity?.id === 'bld-1' ? '#fcd34d' : ['get', 'color'],
                'fill-extrusion-height': ['get', 'height'],
                'fill-extrusion-base': ['get', 'min_height'],
                'fill-extrusion-opacity': selectedEntity?.id === 'bld-1' ? 0.7 : 0.95,
                'fill-extrusion-vertical-gradient': true
              }}
            />
          </Source>

          {/* Skyworth Building Billboard */}
          {selectedEntity?.id === 'bld-1' && (
            <Marker
              longitude={113.9650}
              latitude={22.5400}
              anchor="bottom"
            >
              <div className="flex flex-col items-center pointer-events-none animate-in fade-in zoom-in duration-700">
                <div 
                  className="bg-slate-900/80 backdrop-blur-md border border-amber-300/50 px-3 py-2 rounded-lg shadow-[0_0_15px_rgba(252,211,77,0.3)] flex items-center gap-2 pointer-events-auto cursor-pointer hover:bg-slate-800/80 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/?entityId=bld-1`);
                  }}
                >
                  <div className="w-2 h-2 rounded-full bg-amber-300 animate-pulse shadow-[0_0_8px_rgba(252,211,77,0.8)]"></div>
                  <span className="text-amber-50 font-bold tracking-widest text-sm">创维半导体大厦</span>
                </div>
                <div className="w-0.5 h-32 bg-gradient-to-b from-amber-300/60 via-amber-300/10 to-transparent"></div>
              </div>
            </Marker>
          )}

          {filteredEntities.map((entity) => (
            <Marker
              key={entity.id}
              longitude={entity.lng}
              latitude={entity.lat}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                if (isEventProfile) {
                  if (entity.type === 'event') {
                    navigate(`/event-profile/${entity.id}`);
                  } else {
                    navigate(`/?entityId=${entity.id}`);
                  }
                } else {
                  navigate(`/?entityId=${entity.id}`);
                }
              }}
            >
              {getIcon(entity.type, selectedEntity?.id === entity.id)}
            </Marker>
          ))}
          {selectedEntity && !filteredEntities.find(e => e.id === selectedEntity.id) && (
            <Marker
              key={`selected-${selectedEntity.id}`}
              longitude={selectedEntity.lng}
              latitude={selectedEntity.lat}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                if (isEventProfile) {
                  if (selectedEntity.type === 'event') {
                    navigate(`/event-profile/${selectedEntity.id}`);
                  } else {
                    navigate(`/?entityId=${selectedEntity.id}`);
                  }
                } else {
                  navigate(`/?entityId=${selectedEntity.id}`);
                }
              }}
            >
              {getIcon(selectedEntity.type, true)}
            </Marker>
          )}
        </Map>
      </div>

      {/* Entity Details Popup (Amap Style Bottom Sheet) */}
      {!isEventProfile && selectedEntity && selectedEntity.type === 'camera' && (
        <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-[1000] pb-6 animate-in slide-in-from-bottom-4">
          <div className="w-full py-3 flex justify-center items-center">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>
          
          <div className="px-4 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={handleCloseEntity} className="p-1 -ml-1 text-gray-700">
                <ChevronLeft size={24} />
              </button>
              <h3 className="text-[17px] font-bold text-gray-900">
                {selectedEntity.name}
              </h3>
            </div>
            <div className="flex items-center gap-3 text-gray-400">
              <button className="p-1.5 rounded-xl border border-gray-200 hover:bg-gray-50">
                <RefreshCw size={16} />
              </button>
              <button className="p-1.5 rounded-xl border border-gray-200 hover:bg-gray-50">
                <Star size={16} />
              </button>
              <button className="p-1.5 rounded-xl border border-gray-200 hover:bg-gray-50">
                <Share2 size={16} />
              </button>
            </div>
          </div>

          <div className="px-4">
            <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-black">
              <img 
                src={`https://picsum.photos/seed/${selectedEntity.id}/800/600`} 
                alt={selectedEntity.name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent flex justify-between items-end text-white text-[13px]">
                <span>切片更新倒计时3秒</span>
                <span>2026-02-27 12:30:20</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {!isEventProfile && selectedEntity && selectedEntity.type === 'house' && (
        <BuildingDetailSheet 
          entity={selectedEntity} 
          onClose={handleCloseEntity} 
        />
      )}

      {!isEventProfile && selectedEntity && selectedEntity.type === 'building' && (
        <BuildingTechPanel 
          entity={selectedEntity as any} 
          onClose={handleCloseEntity} 
          onStatChange={handleStatChange}
        />
      )}

      {!isEventProfile && selectedEntity && selectedEntity.type !== 'camera' && selectedEntity.type !== 'house' && selectedEntity.type !== 'building' && (
        <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-[1000] pb-6 animate-in slide-in-from-bottom-4">
          <div className="w-full py-3 flex justify-center items-center">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>
          
          <div className="px-4 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={handleCloseEntity} className="p-1 -ml-1 text-gray-700">
                <ChevronLeft size={24} />
              </button>
              <h3 className="text-[17px] font-bold text-gray-900">
                {selectedEntity.name}
              </h3>
            </div>
            <div className="flex items-center gap-3 text-gray-400">
              <button className="p-1.5 rounded-xl border border-gray-200 hover:bg-gray-50">
                <Navigation size={16} />
              </button>
              <button className="p-1.5 rounded-xl border border-gray-200 hover:bg-gray-50">
                <Star size={16} />
              </button>
              <button className="p-1.5 rounded-xl border border-gray-200 hover:bg-gray-50">
                <Share2 size={16} />
              </button>
            </div>
          </div>

          <div className="px-4">
            <div className="relative w-full aspect-[21/9] rounded-xl overflow-hidden bg-gray-100 mb-4">
              <img 
                src={`https://picsum.photos/seed/${selectedEntity.id}/800/400`} 
                alt={selectedEntity.name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute top-2 left-2 px-2 py-1 bg-black/50 backdrop-blur-sm rounded text-white text-[10px]">
                {selectedEntity.type === 'person' ? '人员信息' : 
                 selectedEntity.type === 'enterprise' ? '企业档案' : 
                 selectedEntity.type === 'event' ? '事件现场' : 
                 selectedEntity.type === 'land' ? '宗地全景' : 
                 selectedEntity.type === 'ownership' ? '权属证明' : 
                 selectedEntity.type === 'parking' ? '停车场实景' : 
                 selectedEntity.type === 'industry' ? '产业园风貌' : '实景图'}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-2 text-sm text-gray-600">
                <MapPin size={16} className="mt-0.5 shrink-0 text-gray-400" />
                <span>{selectedEntity.address}</span>
              </div>
              
              <div className="grid grid-cols-2 gap-3 mt-4">
                {selectedEntity.type === 'person' && (
                  <>
                    <div className="bg-gray-50 p-2 rounded-lg"><div className="text-[11px] text-gray-400">联系电话</div><div className="text-[13px] font-medium mt-0.5">{(selectedEntity as any).phone || '138****8000'}</div></div>
                    <div className="bg-gray-50 p-2 rounded-lg"><div className="text-[11px] text-gray-400">身份证号</div><div className="text-[13px] font-medium mt-0.5">{(selectedEntity as any).idCard || '440305********1234'}</div></div>
                  </>
                )}
                {selectedEntity.type === 'enterprise' && (
                  <>
                    <div className="bg-gray-50 p-2 rounded-lg"><div className="text-[11px] text-gray-400">法人代表</div><div className="text-[13px] font-medium mt-0.5">{(selectedEntity as any).legalPerson || '王某某'}</div></div>
                    <div className="bg-gray-50 p-2 rounded-lg"><div className="text-[11px] text-gray-400">信用代码</div><div className="text-[13px] font-medium mt-0.5">{(selectedEntity as any).creditCode || '91440300MA5F***'}</div></div>
                  </>
                )}
                {selectedEntity.type === 'event' && (
                  <>
                    <div className="bg-gray-50 p-2 rounded-lg"><div className="text-[11px] text-gray-400">事件状态</div><div className="text-[13px] font-medium mt-0.5 text-orange-500">{(selectedEntity as any).status === 'processing' ? '处理中' : '待处理'}</div></div>
                    <div className="bg-gray-50 p-2 rounded-lg"><div className="text-[11px] text-gray-400">上报时间</div><div className="text-[13px] font-medium mt-0.5">{(selectedEntity as any).reportTime?.split('T')[0] || '2026-03-10'}</div></div>
                    <div className="col-span-2 bg-gray-50 p-2 rounded-lg"><div className="text-[11px] text-gray-400">事件描述</div><div className="text-[13px] font-medium mt-0.5">{(selectedEntity as any).description || '暂无详细描述'}</div></div>
                  </>
                )}
                {['land', 'ownership', 'parking', 'industry'].includes(selectedEntity.type) && (
                  <>
                    <div className="bg-gray-50 p-2 rounded-lg"><div className="text-[11px] text-gray-400">管理单位</div><div className="text-[13px] font-medium mt-0.5">白石洲管理处</div></div>
                    <div className="bg-gray-50 p-2 rounded-lg"><div className="text-[11px] text-gray-400">更新时间</div><div className="text-[13px] font-medium mt-0.5">2026-03-10</div></div>
                  </>
                )}
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <button
                onClick={() => {
                  if (selectedEntity.type === 'event') {
                    navigate(`/event-profile/${selectedEntity.id}`);
                  } else {
                    navigate(`/entity/${selectedEntity.id}`);
                  }
                }}
                className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-[15px] font-medium shadow-sm shadow-blue-200 active:bg-blue-700 transition-colors"
              >
                查看详细档案
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Bottom Sheet (Explore / Quick Actions) */}
      {!isEventProfile && !selectedEntity && (
        <div
          className={cn(
            "absolute left-0 right-0 bg-white/90 backdrop-blur-md rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-[900] transition-all duration-300 ease-in-out flex flex-col",
            sheetExpanded ? "bottom-0 h-[55vh]" : "bottom-0 h-auto",
          )}
        >
          {/* Drag Handle */}
          <div
            className="w-full py-3 flex justify-center items-center cursor-pointer"
            onClick={() => setSheetExpanded(!sheetExpanded)}
          >
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>

          <div className="px-4 pb-6 overflow-y-auto hide-scrollbar flex-1">
            {/* Search Bar */}
            <div
              onClick={() => navigate("/search")}
              className="bg-white rounded-xl shadow-sm p-3 mb-4 flex items-center gap-3 pointer-events-auto active:scale-[0.98] transition-transform"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-400 via-purple-400 to-pink-400 flex items-center justify-center opacity-80">
                <Sparkles size={16} className="text-white" />
              </div>
              <span className="text-gray-400 text-sm flex-1">
                智能搜索，支持多要素查询
              </span>
              <div className="w-px h-4 bg-gray-200" />
              <button className="text-blue-500 pr-1">
                <Mic size={20} />
              </button>
            </div>

            {/* Quick Actions Grid */}
            <div className={cn("bg-white rounded-2xl p-4 shadow-sm flex justify-between items-center", sheetExpanded ? "mb-4" : "")}>
              {quickActions.map((action, idx) => (
                <div
                  key={idx}
                  onClick={() => navigate(action.path)}
                  className="flex flex-col items-center gap-2 active:opacity-70"
                >
                  <div
                    className={cn(
                      "w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-sm",
                      action.color,
                    )}
                  >
                    <action.icon size={20} />
                  </div>
                  <span className="text-[13px] text-gray-700 font-medium">
                    {action.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Tabs */}
            {sheetExpanded && (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden animate-in fade-in duration-300">
                <div className="flex border-b border-gray-100">
                  {['实时快讯', '直击现场', '专题应用'].map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={cn(
                        "flex-1 py-3 text-[15px] font-medium transition-colors",
                        activeTab === tab ? "text-blue-600" : "text-gray-500 hover:text-gray-700"
                      )}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

              {/* Tab Content */}
              <div className="p-4">
                {activeTab === '实时快讯' && (
                  <div>
                    <div className="text-red-500 text-sm font-medium mb-4">
                      今日重点关注事件：3
                    </div>
                    
                    <div className="space-y-4">
                      {mockEvents.map((event, index) => (
                        <div 
                          key={event.id}
                          className="flex gap-3 pb-4 border-b border-gray-100 last:border-0 cursor-pointer hover:bg-gray-50 transition-colors"
                          onClick={() => {
                            navigate(`/?entityId=${event.id}`);
                          }}
                        >
                          <img 
                            src={`https://picsum.photos/seed/${event.id}/200/150`} 
                            alt={event.name} 
                            className="w-[100px] h-[75px] rounded-lg object-cover shrink-0"
                            referrerPolicy="no-referrer"
                          />
                          <div className="flex-1 flex flex-col justify-between">
                            <h4 className="text-[15px] font-bold text-gray-900 leading-tight">{event.name}</h4>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-500 rounded">
                                {event.eventType === 'security' ? '安防' : event.eventType === 'complaint' ? '投诉' : '报修'}
                              </span>
                              <span className={cn(
                                "text-[10px] px-1.5 py-0.5 rounded",
                                event.status === 'pending' ? "bg-red-50 text-red-500" : 
                                event.status === 'processing' ? "bg-orange-50 text-orange-500" : 
                                "bg-green-50 text-green-500"
                              )}>
                                {event.status === 'pending' ? '待处理' : event.status === 'processing' ? '处理中' : '已办结'}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">IOT系统</span>
                            </div>
                            <div className="text-[11px] text-gray-400 mt-1.5 flex justify-between">
                              <span className="truncate max-w-[120px]">{event.address}</span>
                              <span>{new Date(event.reportTime).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(/\//g, '-')}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {activeTab !== '实时快讯' && (
                  <div className="py-8 text-center text-gray-400 text-sm">
                    暂无数据
                  </div>
                )}
              </div>
            </div>
            )}
          </div>
        </div>
      )}

      {isEventProfile && <EventProfile />}
    </div>
  );
}
