import path from 'node:path'
import picomatch from 'picomatch'

import type { Mapping } from './types/mapping.type'

function pathMapping(pathname: string, mappings: Mapping[]) {
    for (const mapping of mappings) {
        if (
            !mapping.from.endsWith('/') ||
            !mapping.from.startsWith('/') ||
            !mapping.to.endsWith('/') ||
            !mapping.to.startsWith('/')
        ) {
            continue
        }

        const result = picomatch(mapping.from.replace(/\/$/, '/**'), {
            capture: true,
            nobrace: true,
            nobracket: true,
            noext: true,
            nonegate: true,
        })(pathname, true)

        if (Array.isArray(result.match)) {
            return path.join(mapping.to, result.match.at(-1) ?? '')
        }
    }

    return pathname
}

export { pathMapping }
