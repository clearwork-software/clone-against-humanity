'use client'

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAppSelector } from '@/redux/store'

type SocketContextType = {
	socket: Socket | null
	connected: boolean
	currentGameId: React.RefObject<string | null> | null
	onReconnect: React.RefObject<(() => void) | null> | null
}

const SocketContext = createContext<SocketContextType>({
	socket: null,
	connected: false,
	currentGameId: null,
	onReconnect: null,
})

export const useSocket = () => useContext(SocketContext)

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
	const auth = useAppSelector(({ auth }) => auth)
	const [connected, setConnected] = useState(false)
	const [socket, setSocket] = useState<Socket | null>(null)
	const socketRef = useRef<Socket | null>(null)
	const currentGameId = useRef<string | null>(null)
	const onReconnect = useRef<(() => void) | null>(null)

	useEffect(() => {
		if (!auth.access_token) {
			if (socketRef.current) {
				socketRef.current.disconnect()
				socketRef.current = null
				setSocket(null)
				setConnected(false)
			}
			return
		}

		const newSocket = io(process.env.NEXT_PUBLIC_API as string, {
			auth: {
				token: auth.access_token,
			},
		})

		socketRef.current = newSocket
		setSocket(newSocket)

		newSocket.on('connect', () => {
			setConnected(true)
		})

		newSocket.on('disconnect', () => {
			setConnected(false)
		})

		newSocket.io.on('reconnect', () => {
			if (currentGameId.current) {
				newSocket.emit('join_game', currentGameId.current)
			}
			onReconnect.current?.()
		})

		return () => {
			newSocket.disconnect()
			socketRef.current = null
			setSocket(null)
			setConnected(false)
		}
	}, [auth.access_token])

	const value = useMemo(
		() => ({ socket, connected, currentGameId, onReconnect }),
		[socket, connected]
	)

	return (
		<SocketContext.Provider value={value}>
			{!connected && socket && (
				<div className='fixed top-0 left-0 right-0 z-[200] bg-yellow-500 text-black text-center text-sm py-1'>
					Reconnecting...
				</div>
			)}
			{children}
		</SocketContext.Provider>
	)
}
