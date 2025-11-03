export const formatCamera = (raw : string): string => {
    switch (raw) {
        case "COOLPIX 950": return "Nikon COOLPIX 950";
        case "OM-1MarkII": return "OM-1 Mark II";
        default: return raw
    }
}