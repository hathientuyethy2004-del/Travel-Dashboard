import os

MONGODB_URI = os.getenv("MONGODB_URI", "")
DB_NAME = os.getenv("DB_NAME", "smart_travel_platform")
RAPIDAPI_KEYS = [k.strip() for k in os.getenv("RAPIDAPI_KEYS", "").split(",") if k.strip()]
RAPIDAPI_HOST = "google-map-places.p.rapidapi.com"
NEARBY_SEARCH_URL = "https://google-map-places.p.rapidapi.com/maps/api/place/nearbysearch/json"
PLACE_DETAILS_URL = "https://google-map-places.p.rapidapi.com/maps/api/place/details/json"
TEXT_SEARCH_URL = "https://google-map-places.p.rapidapi.com/maps/api/place/textsearch/json"

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.openstreetmap.fr/api/interpreter",
]

CITIES = {
    "hanoi":    {"name": "Hà Nội",        "nameEn": "Hanoi",      "lat": 21.0278, "lon": 105.8342, "radius_km": 25},
    "hcm":      {"name": "Hồ Chí Minh",   "nameEn": "Ho Chi Minh","lat": 10.8231, "lon": 106.6297, "radius_km": 25},
    "danang":   {"name": "Đà Nẵng",        "nameEn": "Da Nang",    "lat": 16.0544, "lon": 108.2022, "radius_km": 20},
    "cantho":   {"name": "Cần Thơ",        "nameEn": "Can Tho",    "lat": 10.0282, "lon": 105.7851, "radius_km": 15},
    "haiphong": {"name": "Hải Phòng",      "nameEn": "Hai Phong",  "lat": 20.8449, "lon": 106.6881, "radius_km": 15},
    "hue":      {"name": "Huế",            "nameEn": "Hue",        "lat": 16.4637, "lon": 107.5909, "radius_km": 15},
    "nhatrang": {"name": "Nha Trang",      "nameEn": "Nha Trang",  "lat": 12.2588, "lon": 109.1967, "radius_km": 15},
    "dalat":    {"name": "Đà Lạt",         "nameEn": "Da Lat",     "lat": 11.9404, "lon": 108.4453, "radius_km": 12},
    "vungtau":  {"name": "Vũng Tàu",       "nameEn": "Vung Tau",   "lat": 10.2441, "lon": 107.0708, "radius_km": 12},
    "quynhon":  {"name": "Quy Nhơn",       "nameEn": "Quy Nhon",   "lat": 13.7830, "lon": 109.2197, "radius_km": 12},
}

CATEGORIES = {
    "restaurant": [("amenity", "restaurant"), ("amenity", "fast_food")],
    "cafe":       [("amenity", "cafe")],
    "bar":        [("amenity", "bar"), ("amenity", "pub")],
    "hotel":      [("tourism", "hotel"), ("tourism", "guest_house"), ("tourism", "hostel")],
    "attraction": [("tourism", "attraction"), ("tourism", "museum"), ("tourism", "artwork")],
    "park":       [("leisure", "park"), ("leisure", "garden")],
    "shopping":   [("shop", "mall"), ("shop", "supermarket"), ("shop", "department_store")],
}
