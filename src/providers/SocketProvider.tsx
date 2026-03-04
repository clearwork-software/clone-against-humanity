'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
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
	const socketRef = useRef<Socket | null>(null)
	const currentGameId = useRef<string | null>(null)
	const onReconnect = useRef<(() => void) | null>(null)

	useEffect(() => {
		if (!auth.access_token) {
			if (socketRef.current) {
				socketRef.current.disconnect()
				socketRef.current = null
				setConnected(false)
			}
			return
		}

		const socket = io(process.env.NEXT_PUBLIC_API as string, {
			auth: {
				token: auth.access_token,
			},
		})

		socketRef.current = socket

		socket.on('connect', () => {
			setConnected(true)
		})

		socket.on('disconnect', () => {
			setConnected(false)
		})

		socket.io.on('reconnect', () => {
			if (currentGameId.current) {
				socket.emit('join_game', currentGameId.current)
			}
			onReconnect.current?.()
		})

		return () => {
			socket.disconnect()
			socketRef.current = null
			setConnected(false)
		}
	}, [auth.access_token])

	return (
		<SocketContext.Provider
			value={{ socket: socketRef.current, connected, currentGameId, onReconnect }}
		>
			{!connected && socketRef.current && (
				<div className='fixed top-0 left-0 right-0 z-[200] bg-yellow-500 text-black text-center text-sm py-1'>
					Reconnecting...
				</div>
			)}
			{children}
		</SocketContext.Provider>
	)
}
